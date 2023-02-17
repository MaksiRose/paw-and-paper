import { DataTypes, InferAttributes, InferCreationAttributes, Model } from 'sequelize';
import { sequelize } from '..';
import Quid from './quid';
import Group from './group';

export default class GroupToQuid extends Model<InferAttributes<GroupToQuid>, InferCreationAttributes<GroupToQuid>> {
	declare id: number;
	declare groupId: string;
	declare quidId: string;
}

GroupToQuid.init({
	id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
	groupId: { type: DataTypes.STRING, references: { model: Group, key: 'id' } },
	quidId: { type: DataTypes.STRING, references: { model: Quid, key: 'id' } },
}, { sequelize });