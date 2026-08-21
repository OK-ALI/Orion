import { Toggle } from "./SettingsControls";

function statusStyle(status) {
  if (status === "Needs review") {
    return {
      color: "var(--danger)",
      borderColor: "var(--danger)",
      background: "var(--danger-soft)",
    };
  }
  if (status === "Synced" || status === "Syncing") {
    return {
      color: "var(--accent)",
      borderColor: "var(--accent)",
      background: "var(--accent-soft)",
    };
  }
  if (status === "Offline") {
    return {
      color: "var(--warning)",
      borderColor: "var(--warning)",
      background: "var(--warning-soft)",
    };
  }
  return {
    color: "var(--text3)",
    borderColor: "var(--border)",
    background: "var(--surface3)",
  };
}

export default function AccountSyncDomainRow({
  icon,
  title,
  summary,
  status,
  autoSync,
  action,
  children,
}) {
  const pillStyle = statusStyle(status);

  return (
    <div
      style={{
        borderTop: "1px solid var(--border)",
        padding: "16px 0",
      }}
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "40px minmax(0, 1fr) auto auto",
          alignItems: "center",
          gap: 12,
        }}
      >
        <div
          aria-hidden="true"
          style={{
            width: 40,
            height: 40,
            borderRadius: 10,
            background: "var(--accent-soft)",
            color: "var(--accent)",
            display: "grid",
            placeItems: "center",
          }}
        >
          {icon}
        </div>

        <div style={{ minWidth: 0 }}>
          <div style={{ color: "var(--text)", fontSize: 14, fontWeight: 750 }}>
            {title}
          </div>
          <div
            style={{
              color: "var(--text3)",
              fontSize: 12,
              lineHeight: 1.45,
              marginTop: 3,
            }}
          >
            {summary}
          </div>
        </div>

        <span
          style={{
            minHeight: 27,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            border: `1px solid ${pillStyle.borderColor}`,
            borderRadius: 999,
            padding: "4px 9px",
            background: pillStyle.background,
            color: pillStyle.color,
            fontSize: 10,
            fontWeight: 800,
            whiteSpace: "nowrap",
          }}
        >
          {status}
        </span>

        {autoSync ? (
          <Toggle
            value={autoSync.value}
            onChange={autoSync.onChange}
            disabled={autoSync.disabled}
            title={autoSync.label}
          />
        ) : (
          <span style={{ width: 40 }} aria-hidden="true" />
        )}
      </div>

      {action && (
        <div style={{ marginLeft: 52, marginTop: 10 }}>
          <button
            className={action.primary ? "btn btn-primary" : "btn btn-ghost"}
            disabled={action.disabled}
            onClick={action.onClick}
            style={{ fontSize: 12, padding: "7px 12px" }}
          >
            {action.label}
          </button>
        </div>
      )}

      {children ? (
        <div style={{ marginLeft: 52, marginTop: 10 }}>{children}</div>
      ) : null}
    </div>
  );
}
