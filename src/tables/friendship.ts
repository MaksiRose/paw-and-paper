import { DataTypes, InferAttributes, InferCreationAttributes, Model } from 'sequelize';
import { sequelize } from '..';

export default class Friendship extends Model<InferAttributes<Friendship>, InferCreationAttributes<Friendship>> {
	declare id: number;
	declare quidId_1: string;
	declare quidId_2: string;
	declare mentions: number[];
}

Friendship.init({
	id: { type: DataTypes.NUMBER.UNSIGNED, autoIncrement: true, primaryKey: true },
	quidId_1: { type: DataTypes.STRING, references: { model: Friendship, key: 'id' } },
	quidId_2: { type: DataTypes.STRING, references: { model: Friendship, key: 'id' } },
	mentions: { type: DataTypes.ARRAY(DataTypes.BIGINT), defaultValue: [] },
}, { sequelize });