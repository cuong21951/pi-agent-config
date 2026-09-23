import { clamp } from "./util";

export function add(a: number, b: number): number {
	return a + b;
}

export function bounded(value: number): number {
	return clamp(value, 0, 100);
}
