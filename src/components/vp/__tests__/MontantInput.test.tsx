import { describe, it, expect, vi } from "vitest";
import { render, fireEvent } from "@testing-library/react";
import { MontantInput } from "../MontantInput";

describe("MontantInput", () => {
  it("affiche la valeur formatée au montage", () => {
    const { container } = render(<MontantInput value={1234.56} onChange={() => {}} />);
    const input = container.querySelector("input") as HTMLInputElement;
    expect(input.value.replace(/\u00A0|\u202F/g, " ")).toBe("1 234,56");
  });

  it("affiche vide pour null", () => {
    const { container } = render(<MontantInput value={null} onChange={() => {}} />);
    const input = container.querySelector("input") as HTMLInputElement;
    expect(input.value).toBe("");
  });

  it("au focus, passe en valeur brute éditable", () => {
    const { container } = render(<MontantInput value={1234.56} onChange={() => {}} />);
    const input = container.querySelector("input") as HTMLInputElement;
    fireEvent.focus(input);
    expect(input.value).toBe("1234.56");
  });

  it("propage la valeur parsée au blur", () => {
    const onChange = vi.fn();
    const { container } = render(<MontantInput value={null} onChange={onChange} />);
    const input = container.querySelector("input") as HTMLInputElement;
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "1 234,56 €" } });
    fireEvent.blur(input);
    expect(onChange).toHaveBeenCalledWith(1234.56);
  });

  it("distingue vide et zéro", () => {
    const onChange = vi.fn();
    const { container } = render(<MontantInput value={42} onChange={onChange} />);
    const input = container.querySelector("input") as HTMLInputElement;
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "" } });
    fireEvent.blur(input);
    expect(onChange).toHaveBeenCalledWith(null);
    onChange.mockClear();
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "0" } });
    fireEvent.blur(input);
    expect(onChange).toHaveBeenCalledWith(0);
  });

  it("marque aria-invalid et ne propage rien sur saisie invalide", () => {
    const onChange = vi.fn();
    const { container } = render(<MontantInput value={100} onChange={onChange} />);
    const input = container.querySelector("input") as HTMLInputElement;
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "abc" } });
    fireEvent.blur(input);
    expect(onChange).not.toHaveBeenCalled();
    expect(input.getAttribute("aria-invalid")).toBe("true");
  });
});
