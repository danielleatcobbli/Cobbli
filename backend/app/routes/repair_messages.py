"""Staff questions and customer replies using the existing request access model."""

from typing import Annotated
from uuid import UUID, uuid4

from fastapi import APIRouter, File, Form, Header, HTTPException, UploadFile
from pydantic import BaseModel, Field

from app.auth import OptionalUser, StaffUser
from app.repair_approval import authorize_assessment
from app.supabase_client import get_supabase_admin

router = APIRouter(tags=["repair-messages"])


def result(response):
    if getattr(response, "error", None):
        raise HTTPException(503, "Could not save this message. Please try again.")
    return getattr(response, "data", None)


def request_access(sb, request_id, user, token):
    row = result(
        sb.table("assessments")
        .select("id,user_id,proposal_token,status")
        .eq("id", str(request_id))
        .maybe_single()
        .execute()
    )
    if not row:
        raise HTTPException(404, "Request not found")
    authorize_assessment(row, user, token)
    return row


class StaffMessage(BaseModel):
    action: str
    message: str = Field(min_length=1, max_length=4000)


@router.post("/ops/assessments/{request_id}/message")
def staff_message(request_id: UUID, body: StaffMessage, user: StaffUser):
    if body.action not in {"question", "decline"} or not body.message.strip():
        raise HTTPException(400, "Choose an action and enter a message.")
    sb = get_supabase_admin()
    try:
        question_id = result(
            sb.rpc(
                "repair_request_message",
                {
                    "request_id": str(request_id),
                    "action": body.action,
                    "message": body.message.strip(),
                },
            ).execute()
        )
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(
            409, "This request changed or already has a pending question. Refresh and try again."
        ) from exc
    return {"saved": True, "question_id": question_id}


@router.get("/customer/requests/{request_id}/question")
def customer_question(
    request_id: UUID, user: OptionalUser, x_repair_token: Annotated[str | None, Header()] = None
):
    sb = get_supabase_admin()
    request_access(sb, request_id, user, x_repair_token)
    rows = (
        result(
            sb.table("repair_questions")
            .select("id,body,created_at")
            .eq("assessment_id", str(request_id))
            .order("created_at", desc=True)
            .limit(1)
            .execute()
        )
        or []
    )
    if not rows:
        raise HTTPException(404, "No question is available")
    question = rows[0]
    reply = result(
        sb.table("repair_responses")
        .select("id")
        .eq("question_id", question["id"])
        .maybe_single()
        .execute()
    )
    return {**question, "response_received": bool(reply)}


def image_type(content: bytes):
    if content.startswith(b"\xff\xd8\xff"):
        return "image/jpeg"
    if content.startswith(b"\x89PNG\r\n\x1a\n"):
        return "image/png"
    if content[:4] == b"RIFF" and content[8:12] == b"WEBP":
        return "image/webp"
    raise HTTPException(400, "Choose JPG, PNG, or WebP photos.")


@router.post("/customer/requests/{request_id}/responses")
async def customer_response(
    request_id: UUID,
    user: OptionalUser,
    question_id: Annotated[UUID, Form()],
    submission_id: Annotated[UUID, Form()],
    text: Annotated[str, Form()] = "",
    photos: Annotated[list[UploadFile] | None, File()] = None,
    x_repair_token: Annotated[str | None, Header()] = None,
):
    sb = get_supabase_admin()
    row = request_access(sb, request_id, user, x_repair_token)
    question = result(
        sb.table("repair_questions")
        .select("id")
        .eq("id", str(question_id))
        .eq("assessment_id", str(request_id))
        .maybe_single()
        .execute()
    )
    if not question:
        raise HTTPException(404, "Question not found")
    existing = result(
        sb.table("repair_responses")
        .select("id")
        .eq("question_id", str(question_id))
        .maybe_single()
        .execute()
    )
    if existing:
        return {"saved": True, "response_id": existing["id"]}
    photos = photos or []
    if row["status"] != "needs_more_info":
        raise HTTPException(409, "This question is no longer open")
    if len(text) > 4000 or len(photos) > 6 or (not text.strip() and not photos):
        raise HTTPException(400, "Add a reply of up to 4,000 characters or up to six photos.")
    validated = []
    for photo in photos:
        content = await photo.read(10 * 1024 * 1024 + 1)
        if not content or len(content) > 10 * 1024 * 1024:
            raise HTTPException(400, "Each photo must be under 10 MB.")
        validated.append((content, image_type(content)))
    paths = []
    # Unique paths avoid concurrent retries overwriting or deleting another reply.
    # On an ambiguous RPC result retain uploads; deleting might break a saved reply.
    for content, mime in validated:
        path = f"{request_id}/{question_id}/{uuid4()}"
        sb.storage.from_("repair-responses").upload(path, content, {"content-type": mime})
        paths.append(path)
    try:
        response_id = result(
            sb.rpc(
                "save_repair_response",
                {
                    "request_id": str(request_id),
                    "question": str(question_id),
                    "submission": str(submission_id),
                    "message": text.strip(),
                    "photos": paths,
                },
            ).execute()
        )
    except Exception as exc:
        raise HTTPException(409, "We could not confirm your reply. Please try again.") from exc
    return {"saved": True, "response_id": response_id}


@router.get("/ops/assessments/{request_id}/messages")
def staff_history(request_id: UUID, user: StaffUser):
    sb = get_supabase_admin()
    questions = (
        result(
            sb.table("repair_questions")
            .select("id,body,created_at")
            .eq("assessment_id", str(request_id))
            .order("created_at", desc=True)
            .execute()
        )
        or []
    )
    for question in questions:
        reply = result(
            sb.table("repair_responses")
            .select("body,photo_paths,created_at")
            .eq("question_id", question["id"])
            .maybe_single()
            .execute()
        )
        if reply:
            reply["photos"] = [
                sb.storage.from_("repair-responses").create_signed_url(p, 600).get("signedURL")
                for p in reply.pop("photo_paths", [])
            ]
        question["response"] = reply
    return {"data": questions}


class Closure(BaseModel):
    payment_status: str = Field(default="", max_length=4000)
    customer_requested: bool = False


@router.post("/ops/assessments/{request_id}/close")
def close_request(request_id: UUID, body: Closure, user: StaffUser):
    if not body.customer_requested:
        raise HTTPException(400, "Confirm the customer requested closure.")
    try:
        result(
            get_supabase_admin()
            .rpc(
                "close_repair_request",
                {"request_id": str(request_id), "payment_note": body.payment_status},
            )
            .execute()
        )
    except Exception as exc:
        raise HTTPException(
            409, "This request cannot be closed. Refresh and check its status."
        ) from exc
    return {"saved": True}


class Cancellation(BaseModel):
    next_steps: str = Field(min_length=1, max_length=4000)
    payment_status: str = Field(min_length=1, max_length=4000)
    bookings_canceled: bool = False


@router.post("/ops/repairs/{order_id}/cancel")
def cancel_repair(order_id: UUID, body: Cancellation, user: StaffUser):
    # For launch, staff handles calendar changes directly and attests here.
    # This endpoint never promises that it canceled or refunded a booking.
    if not body.bookings_canceled or not body.next_steps.strip() or not body.payment_status.strip():
        raise HTTPException(
            400,
            "Confirm calendar bookings are canceled and enter the customer next steps "
            "and payment status.",
        )
    try:
        result(
            get_supabase_admin()
            .rpc(
                "cancel_repair_notification",
                {
                    "order_id": str(order_id),
                    "next_steps": body.next_steps.strip(),
                    "payment_note": body.payment_status.strip(),
                },
            )
            .execute()
        )
    except Exception as exc:
        raise HTTPException(
            409, "This repair cannot be canceled. Refresh and check its status."
        ) from exc
    return {"saved": True}
