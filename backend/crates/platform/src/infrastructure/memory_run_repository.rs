//! `RunRepository` в памяти процесса (P1.3). Выдаёт стабильные `run_0001`-id.

use std::collections::{HashMap, VecDeque};
use std::sync::RwLock;

use crate::application::ports::RunRepository;
use crate::application::run_record::RunRecord;

/// Кольцевой лимит хранимых прогонов: держим только последние N, чтобы
/// долгоживущий процесс не тёк памятью на демо-нагрузке.
const MAX_RUNS: usize = 64;

#[derive(Default)]
struct Inner {
    runs: HashMap<String, RunRecord>,
    /// Порядок вставки (FIFO) для эвикции старейших прогонов.
    order: VecDeque<String>,
    last: Option<String>,
    counter: u64,
}

#[derive(Default)]
pub struct MemoryRunRepository {
    inner: RwLock<Inner>,
}

impl RunRepository for MemoryRunRepository {
    fn next_run_id(&self) -> String {
        // Отравление замка не должно давать каскадных паник — берём внутренние
        // данные как есть.
        let mut inner = self.inner.write().unwrap_or_else(|e| e.into_inner());
        inner.counter += 1;
        format!("run_{:04}", inner.counter)
    }

    fn store(&self, run: RunRecord) {
        let mut inner = self.inner.write().unwrap_or_else(|e| e.into_inner());
        let id = run.run_id.clone();
        inner.last = Some(id.clone());
        if inner.runs.insert(id.clone(), run).is_none() {
            inner.order.push_back(id);
        }
        while inner.order.len() > MAX_RUNS {
            if let Some(evicted) = inner.order.pop_front() {
                inner.runs.remove(&evicted);
            }
        }
    }

    fn get(&self, run_id: &str) -> Option<RunRecord> {
        self.inner
            .read()
            .unwrap_or_else(|e| e.into_inner())
            .runs
            .get(run_id)
            .cloned()
    }

    fn last(&self) -> Option<RunRecord> {
        let inner = self.inner.read().unwrap_or_else(|e| e.into_inner());
        inner.last.as_ref().and_then(|id| inner.runs.get(id).cloned())
    }
}
