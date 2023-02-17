import { DataTypes, InferAttributes, InferCreationAttributes, Model } from 'sequelize';
import { sequelize } from '..';
import Server from './server';
import Group from './group';

export default class GroupToServer extends Model<InferAttributes<GroupToServer>, InferCreationAttributes<GroupToServer>> {
	declare id: number;
	declare groupId: string;
	declare serverId: string;
	declare tag: string;
}

GroupToServer.init({
	id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
	groupId: { type: DataTypes.STRING, references: { model: Group, key: 'id' } },
	serverId: { type: DataTypes.STRING, references: { model: Server, key: 'id' } },
	tag: { type: DataTypes.STRING, defaultValue: '' },
}, { sequelize });