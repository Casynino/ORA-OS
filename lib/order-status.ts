// Customer-facing order status — friendly labels + messages derived from the
// internal request state. Used on all partner-facing order views so customers
// see a simple, consistent journey:
//   Submitted → Awaiting Payment/Credit → Confirmed → In Transit → Delivered

export type CustomerTone = "info" | "warning" | "success" | "muted" | "danger";

export type CustomerStatus = {
  key: string;
  label: string;
  message: string;
  tone: CustomerTone;
};

export function customerOrderStatus(o: {
  status: string;
  paymentType: string;
  paymentStatus: string;
  paymentClaimedAt?: string | null;
}): CustomerStatus {
  if (o.status === "REJECTED")
    return {
      key: "rejected",
      label: "Not approved",
      message: "This order wasn't approved. Please contact the ORA team.",
      tone: "danger",
    };
  if (o.status === "CANCELLED")
    return {
      key: "cancelled",
      label: "Cancelled",
      message: "This order was cancelled.",
      tone: "muted",
    };
  if (o.status === "FULFILLED")
    return {
      key: "delivered",
      label: "Delivered",
      message:
        "Your order has been delivered successfully. Thank you for choosing ORA.",
      tone: "success",
    };
  if (o.status === "IN_TRANSIT")
    return {
      key: "transit",
      label: "In transit",
      message: "Your order is on its way.",
      tone: "info",
    };

  if (o.status === "APPROVED") {
    if (o.paymentType === "CREDIT")
      return {
        key: "confirmed",
        label: "Confirmed",
        message:
          "Great news! Your order is confirmed and the ORA team is preparing it for dispatch.",
        tone: "success",
      };
    if (o.paymentStatus === "PAID")
      return {
        key: "confirmed",
        label: "Confirmed",
        message:
          "Great news! Your payment is confirmed and the ORA team is preparing your order for dispatch.",
        tone: "success",
      };
    if (o.paymentClaimedAt)
      return {
        key: "verifying",
        label: "Awaiting payment confirmation",
        message:
          "We've received your payment confirmation and are verifying it. Once confirmed, we'll begin preparing your order for shipment.",
        tone: "warning",
      };
    return {
      key: "awaiting_payment",
      label: "Awaiting payment",
      message:
        "We've received your order. Please complete your payment using the details below — once it's confirmed we'll prepare it for delivery.",
      tone: "warning",
    };
  }

  // PENDING / PRICED
  if (o.paymentType === "CREDIT")
    return {
      key: "credit_review",
      label: "Awaiting credit approval",
      message:
        "Your order has been received and is currently under credit review. We'll notify you as soon as it's approved.",
      tone: "info",
    };
  return {
    key: "submitted",
    label: "Submitted",
    message: "We've received your order and it's now being processed.",
    tone: "info",
  };
}
