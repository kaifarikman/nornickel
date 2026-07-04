//! Use case `GET /board`: портфель конкретного прогона (`run_id`) или последнего;
//! до первого /run — fallback через `BoardGateway` (fixtures/board.json).

use contracts::BoardResponse;

use crate::application::error::UseCaseError;
use crate::application::ports::{BoardGateway, RunRepository};

pub fn execute(
    runs: &dyn RunRepository,
    board_gateway: &dyn BoardGateway,
    run_id: Option<String>,
) -> Result<BoardResponse, UseCaseError> {
    if let Some(id) = run_id {
        // Явно запрошенный прогон обязан существовать — иначе 404, а не тихий
        // fallback на демо-фикстуру.
        return runs
            .get(&id)
            .map(|run| run.board)
            .ok_or_else(|| UseCaseError::NotFound(format!("run '{id}' not found")));
    }
    if let Some(run) = runs.last() {
        return Ok(run.board);
    }
    // run_id не задан и прогонов ещё нет — демо-fallback до первого /run.
    board_gateway.load().map_err(UseCaseError::Internal)
}
