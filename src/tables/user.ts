import { DataTypes, InferAttributes, InferCreationAttributes, Model } from 'sequelize';
import { sequelize } from '..';

export default class User extends Model<InferAttributes<User>, InferCreationAttributes<User>> {
	declare id: string;
	declare advice_resting: boolean;
	declare advice_eating: boolean;
	declare advice_drinking: boolean;
	declare advice_passingOut: boolean;
	declare advice_coloredButtons: boolean;
	declare advice_sapling: boolean;
	declare reminders_water: boolean;
	declare reminders_resting: boolean;
	declare proxy_globalAutoproxy: boolean;
	declare proxy_globalStickymode: boolean;
	declare accessibility_replaceEmojis: boolean;
	declare tag: string;
	declare lastPlayedVersion: string;
	declare antiproxy_startsWith: string;
	declare antiproxy_endsWith: string;
}

User.init({
	id: { type: DataTypes.STRING, primaryKey: true },
	advice_resting: { type: DataTypes.BOOLEAN, defaultValue: false },
	advice_eating: { type: DataTypes.BOOLEAN, defaultValue: false },
	advice_drinking: { type: DataTypes.BOOLEAN, defaultValue: false },
	advice_passingOut: { type: DataTypes.BOOLEAN, defaultValue: false },
	advice_coloredButtons: { type: DataTypes.BOOLEAN, defaultValue: false },
	advice_sapling: { type: DataTypes.BOOLEAN, defaultValue: false },
	reminders_water: { type: DataTypes.BOOLEAN, defaultValue: true },
	reminders_resting: { type: DataTypes.BOOLEAN, defaultValue: true },
	proxy_globalAutoproxy: { type: DataTypes.BOOLEAN, defaultValue: false },
	proxy_globalStickymode: { type: DataTypes.BOOLEAN, defaultValue: false },
	accessibility_replaceEmojis: { type: DataTypes.BOOLEAN, defaultValue: false },
	tag: { type: DataTypes.STRING, defaultValue: '' },
	lastPlayedVersion: { type: DataTypes.STRING, defaultValue: '' },
	antiproxy_startsWith: { type: DataTypes.STRING, defaultValue: '' },
	antiproxy_endsWith: { type: DataTypes.STRING, defaultValue: '' },
}, { sequelize });