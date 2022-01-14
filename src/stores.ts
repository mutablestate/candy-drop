import { writable } from "svelte/store";

export const walletAddress = writable<string>("");
export const candyMachineData = writable<object>(null);
