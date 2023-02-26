import { Column, DataType, HasOne, Model, Table } from 'sequelize-typescript';
import Server from './server';

@Table
export default class ProxyLimits extends Model {
	@Column({ type: DataType.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true })
	declare id: number;

	@Column({ type: DataType.BOOLEAN, defaultValue: false })
	declare setToWhitelist: boolean;

	@Column({ type: DataType.ARRAY(DataType.STRING), defaultValue: [] })
	declare whitelist: string[];

	@Column({ type: DataType.ARRAY(DataType.STRING), defaultValue: [] })
	declare blacklist: string[];

	@HasOne(() => Server, { foreignKey: 'proxy_channelLimitsId', onDelete: 'SET NULL' })
	declare server_1?: Server;

	@HasOne(() => Server, { foreignKey: 'proxy_roleLimitsId', onDelete: 'SET NULL' })
	declare server_2?: Server;
}