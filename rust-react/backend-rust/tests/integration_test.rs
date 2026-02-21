use texas_equity_api::cards::{parse_card, validate_input};

#[test]
fn test_parse_card() {
    let c = parse_card("As").unwrap();
    assert_eq!(c.rank, 12);
    assert_eq!(c.suit, 0);
    assert!(parse_card("1s").is_err());
}

#[test]
fn test_validate_hero_board() {
    let hero = vec![parse_card("As").unwrap(), parse_card("Kd").unwrap()];
    let board = vec![];
    assert!(validate_input(&hero, &board).is_ok());
    let board_bad = vec![parse_card("7h").unwrap()];
    assert!(validate_input(&hero, &board_bad).is_err());
}
