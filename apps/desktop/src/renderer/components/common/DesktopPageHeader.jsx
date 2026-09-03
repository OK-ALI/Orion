export default function DesktopPageHeader({
  eyebrow = "",
  title,
  subtitle = "",
  actions = null,
  className = "",
}) {
  return (
    <header className={`orion-page-header${className ? ` ${className}` : ""}`}>
      <div className="orion-page-header-copy">
        {eyebrow && <span className="orion-page-eyebrow">{eyebrow}</span>}
        <h1>{title}</h1>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {actions && <div className="orion-page-header-actions">{actions}</div>}
    </header>
  );
}
