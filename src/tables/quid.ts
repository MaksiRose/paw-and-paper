import { DataTypes, InferAttributes, InferCreationAttributes, Model } from 'sequelize';
import { sequelize } from '..';
import Group from './group';
import User from './user';
const { default_color } = require('../../config.json');

export default class Quid extends Model<InferAttributes<Quid>, InferCreationAttributes<Quid>> {
	declare id: string;
	declare userId: string;
	declare mainGroupId: string | null;
	declare name: string;
	declare nickname: string;
	declare species: string;
	declare displayedSpecies: string;
	declare description: string;
	declare avatarURL: string;
	declare pronouns_en: string[][];
	declare proxy_startsWith: string;
	declare proxy_endsWith: string;
	declare color: string;
}

Quid.init({
	id: { type: DataTypes.STRING, primaryKey: true },
	userId: { type: DataTypes.STRING, references: { model: User, key: 'id' } },
	mainGroupId: { type: DataTypes.STRING, references: { model: Group, key: 'id' } },
	name: { type: DataTypes.STRING },
	nickname: { type: DataTypes.STRING, defaultValue: '' },
	species: { type: DataTypes.STRING, defaultValue: '' },
	displayedSpecies: { type: DataTypes.STRING, defaultValue: '' },
	description: { type: DataTypes.STRING(512), defaultValue: '' },
	avatarURL: { type: DataTypes.STRING, defaultValue: 'https://cdn.discordapp.com/embed/avatars/1.png' },
	pronouns_en: { type: DataTypes.ARRAY(DataTypes.ARRAY(DataTypes.STRING)), defaultValue: [['they', 'them', 'their', 'theirs', 'themselves', 'plural']] },
	proxy_startsWith: { type: DataTypes.STRING, defaultValue: '' },
	proxy_endsWith: { type: DataTypes.STRING, defaultValue: '' },
	color: { type: DataTypes.STRING, defaultValue: default_color },
}, { sequelize });