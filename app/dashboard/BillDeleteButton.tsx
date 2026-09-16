"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function BillDeleteButton({
  billId,
  billNumber,
}: {
  billId: string;
  billNumber: number;
}) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    const confirmed = window.confirm(
      `Delete Bill #${billNumber}?\n\nThis will permanently remove the bill and all items saved inside it. This action cannot be undone.`,
    );

    if (!confirmed) return;

    setDeleting(true);
    try {
      const response = await fetch(`/api/bills/${encodeURIComponent(billId)}`, {
        method: "DELETE",
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.error || "Unable to delete this bill.");
      }

      router.refresh();
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "Unable to delete this bill.");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <button
      type="button"
      className="table-delete-button"
      onClick={handleDelete}
      disabled={deleting}
      aria-label={`Delete bill ${billNumber}`}
    >
      {deleting ? "Deleting..." : "Delete"}
    </button>
  );
}
