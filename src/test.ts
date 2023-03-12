function fact(x: number): number {
	if (x <= 0) {
		return 1;
	}
	return x * fact(x - 1);
}

function choose(n: number, k: number) {
	return Math.round(fact(n) / (fact(k) * fact(n - k)));
}

const x = 4; // all unique items
const y = 0; // all pulled items
const z = 0; // unique pulled items

let k = 0;
let rightSide = 0n;

while (k < z) {

	rightSide += BigInt(Math.pow(-1, k)) * BigInt(choose(z, z - k)) * BigInt(Math.pow(z - k, y));
	k += 1;
}

const numerator = BigInt(choose(x, z)) * rightSide;
const combinations = BigInt(Math.pow(x, y));

const result = (numerator * BigInt(100000)) / combinations;
console.log(Number(result) / 1000, '%');