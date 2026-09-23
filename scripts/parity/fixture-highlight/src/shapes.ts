const PI = 3.14159;

class Circle {
	radius: number;

	constructor(radius: number) {
		this.radius = radius;
	}

	area(): number {
		return PI * this.radius ** 2;
	}
}

export function describe(shape: Circle): string {
	return `circle r=${shape.radius} area=${shape.area().toFixed(2)}`;
}

export const LABEL_PATTERN = /^[a-z]+$/;
