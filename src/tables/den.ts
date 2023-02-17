import { DataTypes, InferAttributes, InferCreationAttributes, Model } from 'sequelize';
import { sequelize } from '..';

export default class Den extends Model<InferAttributes<Den>, InferCreationAttributes<Den>> {
	declare id: number;
	declare structure: number;
	declare bedding: number;
	declare thickness: number;
	declare evenness: number;
}

Den.init({
	id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
	structure: { type: DataTypes.SMALLINT.UNSIGNED, defaultValue: 100 },
	bedding: { type: DataTypes.SMALLINT.UNSIGNED, defaultValue: 100 },
	thickness: { type: DataTypes.SMALLINT.UNSIGNED, defaultValue: 100 },
	evenness: { type: DataTypes.SMALLINT.UNSIGNED, defaultValue: 100 },
}, { sequelize: sequelize });