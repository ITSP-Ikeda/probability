use texas_equity_api::{cards, hand_class, preflop_table, simulate};

use axum::{
    extract::{Query, State},
    http::StatusCode,
    response::IntoResponse,
    routing::{get, post},
    Json, Router,
};
use serde::{Deserialize, Serialize};
use std::net::SocketAddr;
use std::path::PathBuf;
use std::sync::Arc;
use tower_http::services::ServeDir;

#[derive(Clone)]
struct AppState {
    static_dir: Option<PathBuf>,
    preflop_table: Option<Arc<preflop_table::PreflopTable>>,
}

#[derive(Deserialize)]
struct EquityRequest {
    players: u32,
    hero: Vec<String>,
    board: Vec<String>,
    preset: String,
    seed: Option<i64>,
}

#[derive(Serialize)]
struct EquityResponse {
    win: f64,
    tie: f64,
    lose: f64,
    trials: u64,
    #[serde(rename = "elapsedMs")]
    elapsed_ms: u64,
    #[serde(skip_serializing_if = "Option::is_none")]
    method: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    note: Option<String>,
}

#[derive(Serialize)]
struct ErrorResponse {
    error: String,
    details: Option<String>,
    card: Option<String>,
}

async fn equity_handler(
    State(state): State<AppState>,
    Json(body): Json<EquityRequest>,
) -> Result<Json<EquityResponse>, (StatusCode, Json<ErrorResponse>)> {
    if body.players < 2 || body.players > 10 {
        return Err((
            StatusCode::BAD_REQUEST,
            Json(ErrorResponse {
                error: "invalid_players".into(),
                details: Some("players must be between 2 and 10".into()),
                card: None,
            }),
        ));
    }
    if body.hero.len() != 2 {
        return Err((
            StatusCode::BAD_REQUEST,
            Json(ErrorResponse {
                error: "invalid_hero".into(),
                details: Some("hero must be exactly 2 cards".into()),
                card: None,
            }),
        ));
    }
    let hero: Vec<cards::Card> = body
        .hero
        .iter()
        .map(|s| cards::parse_card(s))
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| {
            (
                StatusCode::BAD_REQUEST,
                Json(ErrorResponse {
                    error: e.error,
                    details: e.details,
                    card: e.card,
                }),
            )
        })?;
    let board: Vec<cards::Card> = body
        .board
        .iter()
        .map(|s| cards::parse_card(s))
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| {
            (
                StatusCode::BAD_REQUEST,
                Json(ErrorResponse {
                    error: e.error,
                    details: e.details,
                    card: e.card,
                }),
            )
        })?;
    cards::validate_input(&hero, &board).map_err(|e| {
        (
            StatusCode::BAD_REQUEST,
            Json(ErrorResponse {
                error: e.error,
                details: e.details,
                card: e.card,
            }),
        )
    })?;

    if board.is_empty() {
        let hand_class_str = match hand_class::to_hand_class(&hero) {
            Some(h) => h,
            None => {
                return Err((
                    StatusCode::BAD_REQUEST,
                    Json(ErrorResponse {
                        error: "invalid_hero".into(),
                        details: Some("could not derive hand class from hero cards".into()),
                        card: None,
                    }),
                ));
            }
        };
        if let Some(ref table) = state.preflop_table {
            if let Some(row) = table.get(body.players, &hand_class_str) {
                let note = if body.preset != "standard" || body.seed.is_some() {
                    Some("preset and seed are ignored when using preflop table".into())
                } else {
                    None
                };
                return Ok(Json(EquityResponse {
                    win: row.win,
                    tie: row.tie,
                    lose: row.lose,
                    trials: table.trials_per_hand(),
                    elapsed_ms: 0,
                    method: Some("preflop_table".into()),
                    note,
                }));
            }
        }
    }

    let trials = simulate::trials_for_preset(&body.preset);
    let seed = body.seed.map(|s| s as u64);
    let result = simulate::simulate(body.players, &hero, &board, trials, seed);
    Ok(Json(EquityResponse {
        win: (result.win * 1e6).round() / 1e6,
        tie: (result.tie * 1e6).round() / 1e6,
        lose: (result.lose * 1e6).round() / 1e6,
        trials: result.trials,
        elapsed_ms: result.elapsed_ms,
        method: Some("monte_carlo".into()),
        note: None,
    }))
}

#[derive(Deserialize)]
struct PreflopTableQuery {
    players: Option<u32>,
}

async fn preflop_table_handler(
    State(state): State<AppState>,
    Query(q): Query<PreflopTableQuery>,
) -> Result<Json<serde_json::Value>, (StatusCode, Json<ErrorResponse>)> {
    let players = q.players.ok_or((
        StatusCode::BAD_REQUEST,
        Json(ErrorResponse {
            error: "invalid_players".into(),
            details: Some("players query param required (2-10)".into()),
            card: None,
        }),
    ))?;
    if players < 2 || players > 10 {
        return Err((
            StatusCode::BAD_REQUEST,
            Json(ErrorResponse {
                error: "invalid_players".into(),
                details: Some("players must be between 2 and 10".into()),
                card: None,
            }),
        ));
    }
    let table = state.preflop_table.as_ref().ok_or((
        StatusCode::BAD_REQUEST,
        Json(ErrorResponse {
            error: "preflop_table_not_generated".into(),
            details: Some("preflop table not generated.".into()),
            card: None,
        }),
    ))?;
    let data = table.data.get(&players.to_string()).ok_or((
        StatusCode::BAD_REQUEST,
        Json(ErrorResponse {
            error: "preflop_table_missing_players".into(),
            details: Some(format!("no data for players={}", players)),
            card: None,
        }),
    ))?;
    let out = serde_json::json!({
        "players": players,
        "trialsPerHand": table.trials_per_hand(),
        "data": data,
    });
    Ok(Json(out))
}

async fn serve_spa(State(state): State<AppState>) -> impl IntoResponse {
    let dir = state.static_dir.as_ref().map(|p| p.as_path()).unwrap_or(std::path::Path::new("dist"));
    let index = dir.join("index.html");
    if let Ok(data) = tokio::fs::read(&index).await {
        return (
            [(axum::http::header::CONTENT_TYPE, "text/html; charset=utf-8")],
            data,
        )
            .into_response();
    }
    (StatusCode::NOT_FOUND, "Not Found").into_response()
}

fn load_preflop_table() -> Option<Arc<preflop_table::PreflopTable>> {
    let cwd = std::env::current_dir().unwrap_or_else(|_| PathBuf::from("."));
    let paths = [
        cwd.join("assets/data/preflop_table.v1.json"),
        cwd.join("data/preflop_table.v1.json"),
    ];
    for p in &paths {
        if p.exists() {
            if let Some(t) = preflop_table::load_preflop_table(p) {
                return Some(Arc::new(t));
            }
        }
    }
    None
}

#[tokio::main]
async fn main() {
    let static_dir = std::env::var("STATIC_DIR").ok().map(PathBuf::from);
    let dist = static_dir.clone().unwrap_or_else(|| PathBuf::from("dist"));
    let preflop_table = load_preflop_table();
    let state = AppState {
        static_dir: Some(dist.clone()),
        preflop_table,
    };
    let app = Router::new()
        .route("/api/equity", post(equity_handler))
        .route("/api/preflop-table", get(preflop_table_handler))
        .nest_service("/assets", ServeDir::new(dist.join("assets")))
        .route("/", get(serve_spa))
        .fallback(serve_spa)
        .with_state(state);
    let addr = SocketAddr::from(([0, 0, 0, 0], 8080));
    axum::serve(tokio::net::TcpListener::bind(addr).await.unwrap(), app)
        .await
        .unwrap();
}
