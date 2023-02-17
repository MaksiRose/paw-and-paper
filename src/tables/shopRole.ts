import { DataTypes, InferAttributes, InferCreationAttributes, Model } from 'sequelize';
import { sequelize } from '..';
import Server from './server';

export default class ShopRole extends Model<InferAttributes<ShopRole>, InferCreationAttributes<ShopRole>> {
	declare id: number;
	declare serverId: string;
	declare roleId: string;
	declare wayOfEarning: string;
	declare requirementNumber: number | null;
	declare requirementRank: string | null;
}

ShopRole.init({
	id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
	serverId: { type: DataTypes.STRING, references: { model: Server, key: 'id' } },
	roleId: { type: DataTypes.STRING },
	wayOfEarning: { type: DataTypes.STRING },
	requirementNumber: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
	requirementRank: { type: DataTypes.STRING, allowNull: true },
}, { sequelize });