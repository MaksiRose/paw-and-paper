import { Schema } from '../typings/main';

export interface Temporary_Stat_Increase {
	readonly quid_id: string;
	readonly server_id: string;
	readonly started_at: number;
	type: string;
}

export const temporaryStatIncrease: Schema<Temporary_Stat_Increase> = {
	quid_id: { type: 'string', locked: true },
	server_id: { type: 'string', locked: true },
	started_at: { type: 'number', locked: true },
	type: { type: 'string' },
};

import { DataTypes, InferAttributes, InferCreationAttributes, Model } from 'sequelize';
import { sequelize } from '..';
import Server from './server';
import Quid from './quid';

export default class TemporaryStatIncrease extends Model<InferAttributes<TemporaryStatIncrease>, InferCreationAttributes<TemporaryStatIncrease>> {
	declare id: number;
	declare serverId: string;
	declare quidId: string;
	declare startedTimestamp: number;
	declare type: string;
}

TemporaryStatIncrease.init({
	id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
	serverId: { type: DataTypes.STRING, references: { model: Server, key: 'id' } },
	quidId: { type: DataTypes.STRING, references: { model: Quid, key: 'id' } },
	startedTimestamp: { type: DataTypes.BIGINT, defaultValue: 0 },
	type: { type: DataTypes.STRING },
}, { sequelize });