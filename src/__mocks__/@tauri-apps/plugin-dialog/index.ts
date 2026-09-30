import { vi } from "vitest";

export const open = vi.fn().mockResolvedValue(null);
export const save = vi.fn().mockResolvedValue(null);
export const ask = vi.fn().mockResolvedValue(false);
