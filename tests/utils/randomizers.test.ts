import {
    pullFromWeightedTable,
    generateWinChance,
    getRandomNumber
} from '../../src/utils/randomizers';

jest.mock('../../src/client');

describe(`'getRandomNumber' function tests.`, () => {
    describe(`'size' argument errors.`, () => {
        it(`It should throw an Error if 'size' is NaN.`, () => {
            expect(() => getRandomNumber(NaN)).toThrowError();
        });
    
        it(`It should throw an Error if 'size' is infinite.`, () => {
            expect(() => getRandomNumber(Infinity)).toThrowError();
        });
    
        it(`It should throw a RangeError if 'size' is below zero.`, () => {
            expect(() => getRandomNumber(-1)).toThrowError(RangeError);
        });
    });

    describe(`'minimum' argument errors.`, () => {
        it(`It should throw an Error if 'minimum' is NaN.`, () => {
            expect(() => getRandomNumber(0, NaN)).toThrowError();
        });
    
        it(`It should throw an Error if 'minimum' is infinite.`, () => {
            expect(() => getRandomNumber(0, Infinity)).toThrowError();
        });
    
        it(`It should throw an Error if 'minimum' is not a safe integer.`, () => {
            expect(() => getRandomNumber(0, Math.pow(2, 53))).toThrowError();
        });
    });

    describe(`'exception' argument errors.`, () => {
        it(`It should throw an Error if 'exception' is not a number.`, () => {
            expect(() => getRandomNumber(0, 0, NaN)).toThrowError();
        });
    
        it(`It should throw an Error if 'exception' is infinite.`, () => {
            expect(() => getRandomNumber(0, 0, Infinity)).toThrowError();
        });
    
        it(`It should throw a RangeError if 'exception' is above the range.`, () => {
            expect(() => getRandomNumber(0, 0, 1)).toThrowError(RangeError);
        });
    
        it(`It should throw a RangeError if 'exception' is below the range.`, () => {
            expect(() => getRandomNumber(0, 0, -1)).toThrow(RangeError);
        });
    });

    const size = 5;
    const testedNumbersCount = 10;
    const getNumbersArray = function (generator: () => number): number[] {
        return Array.from({ length: testedNumbersCount }, generator);
    };

    it(`The basic call should return the random number in the interval [0; size).`, () => {
        const numbers = getNumbersArray(() => getRandomNumber(size));

        expect(numbers.every(number => number >= 0 && number < size)).toBeTruthy();
    });

    it(`The call with 'size' and 'minimum' should return the random number in the interval [minimum; minimum + size).`, () => {
        const minimum = 100;
        const numbers = getNumbersArray(() => getRandomNumber(size, minimum));

        expect(numbers.every(number => number >= minimum && number < minimum + size)).toBeTruthy();
    });

    describe(`The call with 'size', 'minimum' and 'exception' should return the random number in the interval [minimum; minimum + size) but not 'exception'.`, () => {
        const minimum = 0;

        it(`Test with two intervals.`, () => {
            const exception = 2;
            const numbers = getNumbersArray(() => getRandomNumber(size, minimum, exception));
    
            expect(numbers.every(number => number >= minimum && number < minimum + size && number != exception)).toBeTruthy();
        });

        it(`Test with the right interval.`, () => {
            const exception = 0;
            const numbers = getNumbersArray(() => getRandomNumber(size, minimum, exception));

            expect(numbers.every(number => number >= minimum && number < minimum + size && number != exception)).toBeTruthy();
        });

        it(`Test with the left interval.`, () => {
            const minimum = 0;
            const exception = 4;
            const numbers = getNumbersArray(() => getRandomNumber(size, minimum, exception));

            expect(numbers.every(number => number >= minimum && number < minimum + size && number != exception)).toBeTruthy();
        });
        
        it(`It should throw an Error if no number is available.`, () => {
            expect(() => {
                getRandomNumber(1, 0, 0);
            }).toThrowError();
        });
    });
});

describe(`'pullFromWeightedTable' function tests.`, () => {
    it(`It should return a weighted random number.`, () => {
        expect([0, 1].includes(pullFromWeightedTable({'0': 1, '1': 10}))).toBeTruthy();
    });

    it(`It should throw a TypeError if 'values' contain no keys.`, () => {
        expect(() => pullFromWeightedTable({})).toThrowError(TypeError);
    });

    it(`It should throw a TypeError if the number is null.`, () => {
        const getNullNumber = (): any => null;

        expect(() => {
            pullFromWeightedTable({'1': getNullNumber()});
        }).toThrowError(TypeError);
    });
});

describe(`'generateWinChance' function tests.`, () => {
    it(`It should return the number between 0 and 100.`, () => {
        const chance = generateWinChance(1, 2);
        expect(chance >= 0 && chance < 100).toBeTruthy();
    });
});