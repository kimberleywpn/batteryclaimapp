import { Tabs } from "antd";

export default function StatusTabs({ items, activeKey, onChange, label, className = "" }) {
  const tabItems = items.map(({ id, label: name, count }) => ({
    key: id,
    label: (
      <span className="status-tab-label">
        <span className="status-tab-name">{name}</span>
        <span className="status-tab-count">{count.toLocaleString()}</span>
      </span>
    ),
  }));

  return (
    <>
      <div className="mobile-progress-tabs" role="group" aria-label={label}>
        {tabItems.map((item) => (
          <button
            key={item.key}
            type="button"
            aria-pressed={activeKey === item.key}
            onClick={() => onChange(item.key)}
          >
            {item.label}
          </button>
        ))}
      </div>
      <Tabs
        className={`status-tabs ${className}`.trim()}
        activeKey={activeKey}
        onChange={onChange}
        items={tabItems}
      />
    </>
  );
}
