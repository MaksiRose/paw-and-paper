import { DataTypes, InferAttributes, InferCreationAttributes, Model } from 'sequelize';
import { sequelize } from '..';
import User from './user';

export default class Group extends Model<InferAttributes<Group>, InferCreationAttributes<Group>> {
	declare id: string;
	declare userId: string;
	declare name: string;
	declare tag: string;
}

Group.init({
	id: { type: DataTypes.STRING, primaryKey: true },
	userId: { type: DataTypes.STRING, references: { model: User, key: 'id' } },
	name: { type: DataTypes.STRING },
	tag: { type: DataTypes.STRING },
}, { sequelize });