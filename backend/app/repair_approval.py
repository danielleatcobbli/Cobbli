"""Canonical approval: the customer's request selects staff-authored lines only."""
from copy import deepcopy
from hmac import compare_digest
from fastapi import HTTPException


def authorize_assessment(row, user, token=None):
    if user is not None and row.get("user_id") == user.id:
        return
    expected = str(row.get("proposal_token") or "")
    if expected and isinstance(token, str) and compare_digest(expected, token):
        return
    raise HTTPException(403, "This repair link is not authorized. Please sign in or use your email link.")


def line_key(line, index):
    return line.get("recommendation_id") or f"{line.get('pair_id') or 'legacy'}:{line.get('service_id')}:{index}"


def approved_payload(row, payload, *, paid=False):
    selected = payload.get("selected_recommendation_ids")
    if not isinstance(selected, list) or not selected or not all(isinstance(k, str) for k in selected) or len(selected) != len(set(selected)):
        raise HTTPException(400, "Select at least one repair.")
    proposed = row.get("proposed_services") or []
    lines = {line_key(s, i): s for i, s in enumerate(proposed)}
    bags = row.get("pairs") or []
    bag_map = {b.get("id"): b for b in bags if b.get("id")}
    groups = set()
    items = []
    for key in selected:
        if not isinstance(key,str) or key not in lines:
            raise HTTPException(409, "Recommendations changed. Please review them again.")
        line = lines[key]
        bag_id = line.get("pair_id")
        if not bag_id and len(bags) == 1:
            bag_id = bags[0].get("id")
        if not bag_id or bag_id not in bag_map:
            raise HTTPException(409, "Please contact us to update the bag assignment for these recommendations.")
        group = line.get("choice_group")
        if group:
            group_key = (bag_id, group)
            if group_key in groups:
                raise HTTPException(400, "Choose only one option for each repair issue.")
            groups.add(group_key)
        snapshot = deepcopy(line)
        snapshot["id"] = line.get("service_id")
        snapshot["recommendation_id"] = key
        price = line.get("price_cents") if paid else 0
        if type(price) is not int or price < 0:
            raise HTTPException(409, "This recommendation needs a valid price. Please contact us.")
        items.append({"pair_snapshot": deepcopy(bag_map[bag_id]), "service_snapshot": snapshot, "price_cents": price})
    result = deepcopy(payload)
    result["items"] = items
    return result
