import { TrashIcon } from "./Icons";

export default function ConfirmModal({
  title,
  message,
  confirmText = "Delete",
  cancelText = "Cancel",
  onConfirm,
  onCancel,
}) {
  return (
    <div className="close-confirm-overlay" style={{ zIndex: 9999999 }}>
      <div className="close-confirm-modal">
        <div className="close-confirm-icon-wrap">
          <div className="close-confirm-icon-ring" style={{ background: "rgba(229, 9, 20, 0.12)", border: "1.5px solid rgba(229, 9, 20, 0.5)" }}>
            <TrashIcon />
          </div>
        </div>

        <div className="close-confirm-title">{title}</div>

        <div className="close-confirm-body" style={{ maxWidth: 320 }}>{message}</div>

        <div className="close-confirm-actions">
          <button className="btn close-confirm-btn-cancel" onClick={onCancel}>
            {cancelText}
          </button>
          <button
            className="btn close-confirm-btn-confirm"
            onClick={onConfirm}
            style={{ background: "var(--red)", borderColor: "var(--red)" }}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
