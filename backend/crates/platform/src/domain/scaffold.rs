//! Bridge from live literature extraction to the engine's generic discovery
//! shape. The LLM extracts factors/mechanisms from text, while the engine
//! needs explicit diagnosis and KPI nodes to connect those claims to plant
//! diagnostics.

use std::collections::HashSet;

use contracts::{EdgeType, ExtractResponse, GraphEdge, GraphNode, NodeKind, Polarity};
use serde_json::{json, Value};

pub fn ensure_generation_scaffold(extract: &mut ExtractResponse) {
    let Some(claim_id) = extract.claims.first().map(|c| c.id.clone()) else {
        return;
    };

    ensure_node(
        extract,
        "node_diag_liberation_deficit",
        NodeKind::Property,
        "потери: недораскрытие сростков",
        &["diagnosis"],
        json!({ "diagnosis": "liberation_deficit" }),
    );
    ensure_node(
        extract,
        "node_diag_slimes_overgrinding",
        NodeKind::Property,
        "потери: переизмельчение/шламы",
        &["diagnosis"],
        json!({ "diagnosis": "slimes_overgrinding" }),
    );
    ensure_node(
        extract,
        "node_diag_flotation_kinetics",
        NodeKind::Property,
        "потери: кинетика/режим флотации",
        &["diagnosis"],
        json!({ "diagnosis": "flotation_kinetics" }),
    );
    ensure_node(
        extract,
        "node_recoverable_losses_element_28",
        NodeKind::Kpi,
        "извлекаемые потери элемента 28 с хвостами",
        &["kpi"],
        json!({ "unit": "t" }),
    );
    ensure_node(
        extract,
        "node_recoverable_losses_element_29",
        NodeKind::Kpi,
        "извлекаемые потери элемента 29 с хвостами",
        &["kpi"],
        json!({ "unit": "t" }),
    );

    for diag in [
        "node_diag_liberation_deficit",
        "node_diag_slimes_overgrinding",
        "node_diag_flotation_kinetics",
    ] {
        ensure_edge(
            extract,
            &format!("edge_scaffold_{diag}_element_28"),
            diag,
            "node_recoverable_losses_element_28",
            "diagnosis_to_kpi",
            &claim_id,
            Polarity::Positive,
        );
        ensure_edge(
            extract,
            &format!("edge_scaffold_{diag}_element_29"),
            diag,
            "node_recoverable_losses_element_29",
            "diagnosis_to_kpi",
            &claim_id,
            Polarity::Positive,
        );
    }

    let controllables: Vec<(String, String)> = extract
        .entities
        .iter_mut()
        .filter(|n| n.kind == NodeKind::Factor || n.has_tag("controllable"))
        .filter_map(|n| {
            if !n.has_tag("controllable") {
                n.tags.push("controllable".to_string());
            }
            annotate_factor_defaults(n);
            Some((n.id.clone(), n.label.clone()))
        })
        .collect();

    for (id, label) in controllables {
        for diag in diagnoses_for_label(&label) {
            ensure_edge(
                extract,
                &format!("edge_scaffold_{}_{}", safe_id(&id), diag),
                &id,
                diag,
                "live_factor_to_diagnosis",
                &claim_id,
                Polarity::Negative,
            );
        }
    }
}

fn ensure_node(
    extract: &mut ExtractResponse,
    id: &str,
    kind: NodeKind,
    label: &str,
    tags: &[&str],
    properties: Value,
) {
    if let Some(node) = extract.entities.iter_mut().find(|n| n.id == id) {
        for tag in tags {
            if !node.tags.iter().any(|t| t == tag) {
                node.tags.push((*tag).to_string());
            }
        }
        merge_props(&mut node.properties, properties);
        return;
    }
    extract.entities.push(GraphNode {
        id: id.to_string(),
        kind,
        label: label.to_string(),
        tags: tags.iter().map(|t| (*t).to_string()).collect(),
        properties,
    });
}

fn ensure_edge(
    extract: &mut ExtractResponse,
    id: &str,
    src: &str,
    dst: &str,
    mechanism: &str,
    claim_id: &str,
    polarity: Polarity,
) {
    if extract
        .edges
        .iter()
        .any(|e| e.id == id || (e.src == src && e.dst == dst && e.edge_type == EdgeType::Mechanism))
    {
        return;
    }
    extract.edges.push(GraphEdge {
        id: id.to_string(),
        src: src.to_string(),
        dst: dst.to_string(),
        edge_type: EdgeType::Mechanism,
        mechanism: Some(mechanism.to_string()),
        source_claims: vec![claim_id.to_string()],
        polarity: Some(polarity),
    });
}

fn annotate_factor_defaults(node: &mut GraphNode) {
    let label = normalize(&node.label);
    let (lever_type, capex) = if has_any(&label, &["грохоч", "сепарац", "screen", "separation"])
    {
        ("new_equipment", 3)
    } else if has_any(
        &label,
        &["мель", "измельч", "шар", "футеров", "grind", "mill"],
    ) {
        ("grinding", 1)
    } else if has_any(
        &label,
        &["классиф", "гидроциклон", "насад", "cyclone", "classifier"],
    ) {
        ("classification", 1)
    } else if has_any(
        &label,
        &["депресс", "собират", "реагент", "collector", "reagent"],
    ) {
        ("reagents", 1)
    } else if has_any(
        &label,
        &["флот", "пульп", "агитац", "аэра", "flotation", "pulp"],
    ) {
        ("flotation", 1)
    } else {
        ("flotation", 1)
    };
    set_default_prop(&mut node.properties, "lever_type", json!(lever_type));
    set_default_prop(&mut node.properties, "capex_class", json!(capex));
}

fn diagnoses_for_label(label: &str) -> Vec<&'static str> {
    let label = normalize(label);
    let mut out = Vec::new();
    if has_any(
        &label,
        &[
            "классиф",
            "грохоч",
            "гидроциклон",
            "насад",
            "измельч",
            "мель",
            "раскрыт",
            "classifier",
            "cyclone",
            "screen",
            "grind",
            "mill",
            "liberat",
        ],
    ) {
        out.push("node_diag_liberation_deficit");
    }
    if has_any(
        &label,
        &[
            "шлам",
            "переизмельч",
            "тонк",
            "-10",
            "slime",
            "overgrind",
            "fine",
        ],
    ) {
        out.push("node_diag_slimes_overgrinding");
    }
    if has_any(
        &label,
        &[
            "флот",
            "пульп",
            "агитац",
            "депресс",
            "собират",
            "аэра",
            "flotation",
            "pulp",
            "collector",
            "depress",
            "aerat",
        ],
    ) {
        out.push("node_diag_flotation_kinetics");
    }
    if out.is_empty() {
        out.push("node_diag_flotation_kinetics");
    }
    dedupe(out)
}

fn dedupe(values: Vec<&'static str>) -> Vec<&'static str> {
    let mut seen = HashSet::new();
    values.into_iter().filter(|v| seen.insert(*v)).collect()
}

fn has_any(text: &str, needles: &[&str]) -> bool {
    needles.iter().any(|needle| text.contains(needle))
}

fn normalize(s: &str) -> String {
    s.to_lowercase().replace('ё', "е")
}

fn safe_id(s: &str) -> String {
    s.chars()
        .map(|c| if c.is_ascii_alphanumeric() { c } else { '_' })
        .collect()
}

fn set_default_prop(properties: &mut Value, key: &str, value: Value) {
    if !properties.is_object() {
        *properties = json!({});
    }
    if properties.get(key).is_none() {
        if let Some(obj) = properties.as_object_mut() {
            obj.insert(key.to_string(), value);
        }
    }
}

fn merge_props(properties: &mut Value, patch: Value) {
    if !properties.is_object() {
        *properties = json!({});
    }
    let Some(dst) = properties.as_object_mut() else {
        return;
    };
    if let Some(src) = patch.as_object() {
        for (key, value) in src {
            dst.entry(key.clone()).or_insert_with(|| value.clone());
        }
    }
}
