import { readdirSync, readFileSync, unlinkSync, writeFileSync } from 'fs';
import { Schema } from '../typedef';
import { generateId } from 'crystalid';

interface UUIDObject {
	uuid: string;
}

export default class Model<T extends UUIDObject> {

	path: string;
	schema: Schema<T>;
	save: (updateObject: T) => Promise<void>;
	find: (filter?: (value: T) => boolean) => Promise<Array<T>>;
	findOne: (filter: (value: T) => boolean) => Promise<T>;
	create: (dataObject: T) => Promise<T>;
	findOneAndDelete: (filter: (value: T) => boolean) => Promise<void>;
	findOneAndUpdate: (filter: (value: T) => boolean, updateFunction: (value: T) => void) => Promise<T>;
	update: (uuid: string) => Promise<T>;

	constructor(path: string, schema: Schema<T>) {

		this.path = path;
		this.schema = schema;

		/** Overwrites a file in the database. **Caution:** This could make unexpected changes to the file! */
		this.save = async (updateObject: T): Promise<void> => {

			let dataObject = JSON.parse(JSON.stringify(updateObject)) as T;

			/* Add / Update existing keys */
			for (const [key, value] of Object.entries(schema)) {

				dataObject = checkTypeMatching(dataObject, key, value);
			}

			/* Get rid of keys that aren't in schema */
			for (const key of Object.keys(dataObject)) {

				const keys = Object.keys(schema);
				if (!keys.includes(key)) { delete dataObject[key]; }
			}

			if (JSON.stringify(updateObject) !== JSON.stringify(dataObject)) {

				console.trace(`Object inconsistency, received: ${JSON.stringify(updateObject)} but needed: ${JSON.stringify(dataObject)}`);
				throw new TypeError('Type of received object is not assignable to type of database.');
			}

			writeFileSync(`${path}/${updateObject.uuid}.json`, JSON.stringify(updateObject, null, '\t'));
		};

		/** Searches for all objects that meet the filter, and returns an array of them. */
		this.find = async (filter?: (value: T) => boolean): Promise<Array<T>> => {

			const allDocumentNames = readdirSync(path).filter(f => f.endsWith('.json'));
			return allDocumentNames
				.map(documentName => {
					return JSON.parse(readFileSync(`${path}/${documentName}`, 'utf-8')) as T;
				})
				.filter(v => {
					if (typeof filter === 'function') { return filter(v); }
					return true;
				});
		};

		/** Searches for an object that meets the filter, and returns it. If several objects meet the requirement, the first that is found is returned. */
		this.findOne = async (filter: (value: T) => boolean): Promise<T> => {

			const foundDocuments = await this.find(filter);
			if (foundDocuments.length > 0) { return foundDocuments[0]; }

			throw new Error('Could not find a document with the given filter.');
		};

		/** Creates a new database entry. */
		this.create = async (dataObject: T): Promise<T> => {

			dataObject.uuid = generateId();
			this.save(dataObject);

			console.log('Created File: ', dataObject.uuid);
			return dataObject;
		};

		/** Searches for an object that meets the filter, and deletes it. If several objects meet the requirement, the first that is found is deleted. */
		this.findOneAndDelete = async (filter: (value: T) => boolean): Promise<void> => {

			const dataObject = await this.findOne(filter);

			unlinkSync(`${path}/${dataObject.uuid}.json`);

			console.log('Deleted File: ', dataObject.uuid);

			return;
		};

		/** Searches for an object that meets the filter, and updates it. If several objects meet the requirement, the first that is found is updated. */
		this.findOneAndUpdate = async (filter: (value: T) => boolean, updateFunction: (value: T) => void): Promise<T> => {

			const dataObject = await this.findOne(filter);
			const newDataObject = JSON.parse(JSON.stringify(dataObject)) as T;
			updateFunction(newDataObject);

			createLog(createLogArray(dataObject, newDataObject, ''));

			await this.save(newDataObject);

			return newDataObject;


			type LogArray = Array<{ path: string, oldValue: string, newValue: string; }>;
			/** It takes two objects, compares them, and logs the differences */
			function createLogArray<Type>(oldObject: Type, newObject: Type, variablePath: string): LogArray {

				let allPaths: LogArray = [];

				for (const key of Object.keys(Object.keys(newObject).length === 0 && Object.keys(oldObject).length > 0 ? oldObject : newObject)) {

					const isObject = (val: any) => typeof val === 'object' && val !== null;
					const hasObjectsAsValues = (val: any) => Object.values(val).filter(v => isObject(v)).length > 0;
					if (isObject(newObject?.[key]) && (hasObjectsAsValues(newObject?.[key]) || (isObject(oldObject?.[key]) && hasObjectsAsValues(oldObject?.[key])))) {

						allPaths = allPaths.concat(createLogArray(oldObject?.[key], newObject?.[key], variablePath + `.${key}`));
					}
					else if (formatLog(oldObject?.[key], newObject?.[key]) != formatLog(newObject?.[key], oldObject?.[key])) {

						allPaths.push({ path: `${variablePath}.${key}`, oldValue: formatLog(oldObject?.[key], newObject?.[key]), newValue: formatLog(newObject?.[key], oldObject?.[key]) });
					}
				}
				return allPaths;
			}

			/** Formats a variable to be readable for the log output. */
			function formatLog<Type>(main: Type, other: Type): string {

				if (!isObjectOrArray(main)) {

					return `${main}`;
				}

				if (Array.isArray(main)) {

					return `[${main.join(', ')}]`;
				}

				let result = JSON.stringify(objectReducer(main, other), null, 1);
				result = result.replace(/^ +/gm, ' ');
				result = result.replace(/\n/g, '');
				result = result.replace(/"/g, '');
				result = result.replace(/{ /g, '{').replace(/ }/g, '}');
				result = result.replace(/\[ /g, '[').replace(/ \]/g, ']');
				return result;

				function isObjectOrArray(obj: any): boolean { return obj === Object(obj); }

				function objectReducer<Type1>(mainObject: Type1, otherObject: Type1): Type1 {

					let newObject = {} as Type1;

					for (const key of Object.keys(mainObject)) {

						if (!isObjectOrArray(mainObject[key])) {

							if (mainObject[key] != otherObject?.[key]) {

								newObject[key] = mainObject[key];
							}

							continue;
						}
						else {

							newObject = { ...newObject, ...objectReducer(mainObject[key], otherObject?.[key]) };
						}
					}

					return newObject;
				}
			}

			function createLog(logArray: LogArray): void {

				for (const { path, oldValue, newValue } of logArray) {

					console.log(`\x1b[32m${dataObject?.uuid}\x1b[0m${path} changed from \x1b[33m${oldValue} \x1b[0mto \x1b[33m${newValue} \x1b[0mat \x1b[3m${new Date().toLocaleString()} \x1b[0m`);
				}
			}
		};


		/** Updates the information of a file to be accurate to the schema */
		this.update = async (uuid: string): Promise<T> => {

			let dataObject = await this.findOne(v => v.uuid === uuid); // Technically unsafe, due to literal-string uuid types... but unrealistic

			/* Add / Update existing keys */
			for (const [key, value] of Object.entries(schema)) {

				dataObject = checkTypeMatching(dataObject, key, value);
			}

			/* Get rid of keys that aren't in schema */
			for (const key of Object.keys(dataObject)) {

				const keys = Object.keys(schema);
				if (!keys.includes(key)) { delete dataObject[key]; }
			}

			await this.save(dataObject);

			return dataObject;
		};
		for (const file of readdirSync(path).filter(f => f.endsWith('.json'))) {

			this.update(file.replace('.json', ''));
		}
	}
}

function primitiveTypeDoesNotMatch(value: Schema<any>[any], valToCheck: any): value is ({ type: 'string', default: string, locked: boolean; } | { type: 'string?', default: string | null, locked: boolean; } | { type: 'number', default: number, locked: boolean; } | { type: 'number?', default: string | null, locked: boolean; } | { type: 'string|number', default: string | number, locked: boolean; } | { type: 'boolean', default: boolean, locked: boolean; }) {

	const isNotString = value.type === 'string' && typeof valToCheck !== 'string';
	const isNotStringOrNull = value.type === 'string?' && valToCheck !== null && typeof valToCheck !== 'string';
	const isNotNumber = value.type === 'number' && typeof valToCheck !== 'number';
	const isNotNumberOrNull = value.type === 'number?' && valToCheck !== null && typeof valToCheck !== 'number';
	const isNotStringOrNumber = value.type === 'string|number' && typeof valToCheck !== 'string' && typeof valToCheck !== 'number';
	const isNotBoolean = value.type === 'boolean' && typeof valToCheck !== 'boolean';
	return isNotString || isNotStringOrNull || isNotNumber || isNotNumberOrNull || isNotStringOrNumber || isNotBoolean;
}

function checkTypeMatching<T extends object | Array<any>>(obj: T, key: string | number, value: Schema<T>[any]): T {

	// Add key if object doesn't have it
	if (!Array.isArray(obj) && !Object.hasOwn(obj, key)) {

		if (value.type === 'array') { obj[key] = []; }
		else if (value.type === 'map' || value.type === 'object') { obj[key] = {}; }
		else { obj[key] = value.default; }
	}

	// Change value to default value if value type is primitive and doesn't match
	if (primitiveTypeDoesNotMatch(value, obj[key])) { obj[key] = value.default; }
	// Change value if value type is array
	else if (value.type === 'array') {

		// Change value if value is array
		if (Array.isArray(obj[key])) {

			for (let k = 0; k < obj[key].length; k++) {

				obj[key] = checkTypeMatching(obj[key], k, value.of);
			}
		}
		// Change value to array if value isn't
		else { obj[key] = []; }
	}
	else if (value.type === 'map') {

		// Change value to object if value isn't
		if (obj[key] !== Object(obj[key]) && !Array.isArray(obj[key])) { obj[key] = {}; }
		// Change value if value is object
		else {

			for (const k of Object.keys(obj[key])) {

				obj[key] = checkTypeMatching(obj[key], k, value.of);
			}
		}
	}
	else if (value.type === 'object') {

		// Change value to object if value isn't
		if (obj[key] !== Object(obj[key]) && !Array.isArray(obj[key])) { obj[key] = {}; }

		/* Add / Update existing keys */
		for (const [k, v] of Object.entries(value.default)) {

			obj[key] = checkTypeMatching(obj[key], k, v);
		}

		/* Get rid of keys that aren't in schema */
		for (const k of Object.keys(obj[key])) {

			const keys = Object.keys(value.default);
			if (!keys.includes(k)) { delete obj[key][k]; }
		}
	}

	return obj;
}