import { DataTypes, InferAttributes, InferCreationAttributes, Model } from 'sequelize';
import { sequelize } from '..';

export default class ProxyLimits extends Model<InferAttributes<ProxyLimits>, InferCreationAttributes<ProxyLimits>> {
	declare id: number;
	declare setToWhitelist: boolean;
	declare whitelist: string[];
	declare blacklist: string[];
}

ProxyLimits.init({
	id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
	setToWhitelist: { type: DataTypes.BOOLEAN, defaultValue: false },
	whitelist: { type: DataTypes.ARRAY(DataTypes.STRING), defaultValue: [] },
	blacklist: { type: DataTypes.ARRAY(DataTypes.STRING), defaultValue: [] },
}, { sequelize });