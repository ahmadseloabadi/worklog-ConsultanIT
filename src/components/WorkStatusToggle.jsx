export default function WorkStatusToggle({ value, onChange }) {
  return (
    <fieldset className="field work-status-field">
      <legend className="field-label">Status pekerjaan</legend>
      <div className="work-status-options">
        <label className={`work-status-option${value === "pending" ? " is-selected" : ""}`}>
          <input
            type="radio"
            name="work-status"
            value="pending"
            checked={value === "pending"}
            onChange={() => onChange("pending")}
          />
          <span>Tertunda</span>
        </label>
        <label className={`work-status-option${value === "completed" ? " is-selected" : ""}`}>
          <input
            type="radio"
            name="work-status"
            value="completed"
            checked={value === "completed"}
            onChange={() => onChange("completed")}
          />
          <span>Selesai</span>
        </label>
      </div>
    </fieldset>
  );
}
