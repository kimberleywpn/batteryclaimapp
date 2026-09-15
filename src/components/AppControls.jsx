import { useMemo } from "react";
import {
  Button,
  Cascader,
  DatePicker,
  Input,
  InputNumber,
  Pagination,
} from "antd";
import { Search as SearchIcon } from "lucide-react";
import dayjs from "dayjs";

export const TextArea = Input.TextArea;
export const RangePicker = DatePicker.RangePicker;

export function advanceFieldOnEnter(event) {
  if (
    event.key !== "Enter" ||
    event.shiftKey ||
    event.target.tagName === "TEXTAREA" ||
    event.target.tagName === "BUTTON"
  )
    return;
  event.preventDefault();
  const fields = [
    ...event.currentTarget.querySelectorAll(
      'input:not([type="hidden"]):not([disabled]):not([readonly])',
    ),
  ].filter((field) => field.offsetParent !== null);
  const current = fields.indexOf(event.target);
  if (current >= 0 && current < fields.length - 1) fields[current + 1].focus();
}

export function SearchInput({ className = "", onSearch, enterButton, ...props }) {
  return (
    <div className={`app-search-control ${className}`.trim()}>
      <Input
        {...props}
        size="large"
        onPressEnter={(event) => onSearch?.(event.currentTarget.value)}
      />
      <Button
        className="app-search-button"
        size="large"
        icon={enterButton || <SearchIcon size={17} />}
        onClick={() => onSearch?.(props.value ?? "")}
        aria-label="Search"
      />
    </div>
  );
}

export function AppDatePicker({ value, onChange, required = false, ...props }) {
  return (
    <DatePicker
      className="app-date-picker"
      value={value ? dayjs(value, "YYYY-MM-DD") : null}
      onChange={(date) => onChange(date?.format("YYYY-MM-DD") || "")}
      format="DD-MM-YYYY"
      placeholder="Select Date"
      allowClear={!required}
      {...props}
    />
  );
}

export function AppPagination({ page, total, onChange, pageSize = 10 }) {
  return (
    <div className="app-pagination">
      <span>
        {total
          ? `Showing ${(page - 1) * pageSize + 1}-${Math.min(page * pageSize, total)} of ${total.toLocaleString()}`
          : "Showing 0 Records"}
      </span>
      <Pagination current={page} total={total} pageSize={pageSize} onChange={onChange} showSizeChanger={false} hideOnSinglePage={false} />
    </div>
  );
}

export function AppFieldInput({ name, value, onChange, type, ...props }) {
  if (type === "number")
    return (
      <InputNumber
        className="form-input-number"
        name={name}
        value={value === "" ? null : Number(value)}
        onChange={(next) => onChange({ target: { name, value: next == null ? "" : String(next) } })}
        {...props}
      />
    );
  return <Input name={name} value={value} onChange={onChange} type={type} {...props} />;
}

export function AppButton({ className = "", danger = false, ...props }) {
  return <Button type={className.includes("primary") ? "primary" : "default"} danger={danger || className.includes("danger-action")} className={className} {...props} />;
}

function optionPaths(options, path = []) {
  return options.flatMap((option) =>
    option.children?.length
      ? optionPaths(option.children, [...path, option.value])
      : [[...path, option.value]],
  );
}

export function CheckFilter({ label, options, selected, onChange }) {
  const paths = useMemo(() => optionPaths(options), [options]);
  return (
    <Cascader
      className="app-filter-cascader"
      style={{ width: "100%" }}
      options={options}
      value={paths.filter((path) => selected.includes(path.at(-1)))}
      onChange={(values) => onChange(values.map((path) => path.at(-1)))}
      multiple
      maxTagCount="responsive"
      allowClear
      showSearch
      placeholder={`${label}: All`}
      showCheckedStrategy={Cascader.SHOW_CHILD}
    />
  );
}
