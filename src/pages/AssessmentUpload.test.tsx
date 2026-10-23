import { useState } from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ preview: vi.fn() }));
vi.mock("@/lib/heicPreview", () => ({ createPreviewUrl: mocks.preview }));
vi.mock("@/components/cobbli/Header", () => ({ default: () => null }));
vi.mock("@/components/cobbli/Footer", () => ({ default: () => null }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { storage: { from: () => ({ upload: async () => ({ error: null }) }) } } }));
import AssessmentUpload, { ItemUploadCard } from "./AssessmentUpload";
vi.mock("@/context/AuthContext", () => ({ useAuth: () => ({ user: { id: "test-user" } }) }));
vi.mock("@/hooks/useServiceableZips", () => ({ useServiceableZips: () => ({ isServiceable: (zip: string) => zip === "10001" }) }));
import { MemoryRouter } from "react-router-dom";
function Harness() {
  const [files, setFiles] = useState<any[]>([]);
  return <ItemUploadCard item={{ key: "test", files, description: "" }} index={0} total={1} showError={false}
    onFilesChange={setFiles} onDescriptionChange={() => {}} onRemove={() => {}}
    onFileUploadFailed={() => {}} startUpload={async f => f.name} cardRef={() => {}} />;
}
beforeEach(() => {
  vi.clearAllMocks();
  URL.createObjectURL = vi.fn(() => "blob:original");
  URL.revokeObjectURL = vi.fn();
});
it("keeps the HEIC and later-added photos when conversion completes", async () => {
  let finish!: (url: string) => void;
  mocks.preview.mockReturnValue(new Promise<string>(resolve => { finish = resolve; }));
  const { container } = render(<Harness />);
  const input = container.querySelector('input[type="file"]')!;
  fireEvent.change(input, { target: { files: [new File(["heic"], "bag.heic", { type: "image/heic" })] } });
  fireEvent.change(input, { target: { files: [new File(["jpg"], "detail.jpg", { type: "image/jpeg" })] } });
  await act(async () => { finish("blob:converted"); });
  expect(screen.getAllByRole("img")).toHaveLength(2);
  expect(screen.getByAltText("Upload 1")).toHaveAttribute("src", "blob:converted");
});
it("does not restore a photo removed while conversion is pending", async () => {
  let finish!: (url: string) => void;
  mocks.preview.mockReturnValue(new Promise<string>(resolve => { finish = resolve; }));
  const { container } = render(<Harness />);
  fireEvent.change(container.querySelector('input[type="file"]')!, { target: { files: [new File(["heic"], "bag.heic")] } });
  fireEvent.click(screen.getByRole("button", { name: "Remove file 1" }));
  await act(async () => { finish("blob:converted"); });
  expect(screen.queryByRole("img")).not.toBeInTheDocument();
});
it("keeps a photo with a clear fallback if conversion fails", async () => {
  mocks.preview.mockRejectedValue(new Error("conversion failed"));
  const { container } = render(<Harness />);
  fireEvent.change(container.querySelector('input[type="file"]')!, { target: { files: [new File(["heic"], "bag.heic")] } });
  expect(await screen.findByText(/Preview unavailable/)).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Remove file 1" })).toBeInTheDocument();
});


it("shows field-specific errors only after submission and clears corrected errors", () => {
  HTMLElement.prototype.scrollIntoView = vi.fn();
  render(<MemoryRouter><AssessmentUpload /></MemoryRouter>);
  expect(screen.queryByText("Enter your ZIP code.")).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Submit request" }));
  expect(screen.getByText("Add at least one photo of this bag.")).toBeInTheDocument();
  expect(screen.getByText("Enter your ZIP code.")).toBeInTheDocument();
  expect(screen.getByText("Enter your email address.")).toBeInTheDocument();
  expect(screen.queryByText("Please complete all required fields.")).not.toBeInTheDocument();
  fireEvent.change(screen.getByLabelText(/Zip code/), { target: { value: "1000" } });
  expect(screen.getByText("Enter a 5-digit ZIP code.")).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText(/Email address/), { target: { value: "invalid" } });
  expect(screen.getByText("Enter a valid email address.")).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText(/Zip code/), { target: { value: "10001" } });
  fireEvent.change(screen.getByLabelText(/Email address/), { target: { value: "test@example.com" } });
  expect(screen.queryByText("Enter a 5-digit ZIP code.")).not.toBeInTheDocument();
  expect(screen.queryByText("Enter a valid email address.")).not.toBeInTheDocument();
});
it("focuses an incomplete ZIP after photos are added and preserves other fields", async () => {
  HTMLElement.prototype.scrollIntoView = vi.fn();
  const { container } = render(<MemoryRouter><AssessmentUpload /></MemoryRouter>);
  await act(async () => fireEvent.change(container.querySelector('input[type="file"]')!, { target: { files: [new File(["jpg"], "bag.jpg", { type: "image/jpeg" })] } }));
  fireEvent.change(screen.getByLabelText(/Zip code/), { target: { value: "1000" } });
  fireEvent.change(screen.getByLabelText(/Email address/), { target: { value: "test@example.com" } });
  fireEvent.click(screen.getByRole("button", { name: "Submit request" }));
  expect(screen.getByLabelText(/Zip code/)).toHaveFocus();
  expect(screen.getByText("Enter a 5-digit ZIP code.")).toBeInTheDocument();
  expect(screen.getByLabelText(/Email address/)).toHaveValue("test@example.com");
  expect(screen.getByAltText("Upload 1")).toBeInTheDocument();
});
