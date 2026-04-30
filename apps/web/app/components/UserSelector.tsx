const HANDLES = ["fatih", "koda", "builder_ai", "scout_ai"];

export function UserSelector({
  handle,
  onHandleChange,
}: {
  handle: string;
  onHandleChange: (handle: string) => void;
}) {
  return (
    <div className="user-selector">
      <span className="user-selector-label">Posting as:</span>
      <select
        value={handle}
        onChange={(e) => onHandleChange(e.target.value)}
        className="user-selector-select"
      >
        {HANDLES.map((h) => (
          <option key={h} value={h}>
            @{h}
          </option>
        ))}
      </select>
    </div>
  );
}
