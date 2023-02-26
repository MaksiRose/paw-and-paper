import { BelongsTo, Column, DataType, ForeignKey, Model, Table } from 'sequelize-typescript';
import Quid from './quid';
import Server from './server';
import User from './user';

@Table
export default class UserToServer extends Model {
	@Column({ type: DataType.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true })
	declare id: number;

	@ForeignKey(() => User)
	@Column({ type: DataType.STRING })
	declare userId: string;

	@ForeignKey(() => Server)
	@Column({ type: DataType.STRING })
	declare serverId: string;

	@ForeignKey(() => Quid)
	@Column({ type: DataType.STRING, allowNull: true })
	declare lastProxiedQuidId: string | null;

	@BelongsTo(() => Quid, { foreignKey: 'lastProxiedQuidId' })
	declare lastProxiedQuid: Quid | null;

	@ForeignKey(() => Quid)
	@Column({ type: DataType.STRING, allowNull: true })
	declare activeQuidId: string | null;

	@BelongsTo(() => Quid, { foreignKey: 'activeQuidId' })
	declare activeQuid: Quid | null;

	@Column({ type: DataType.BOOLEAN, allowNull: true, defaultValue: null })
	declare autoproxy_setToWhitelist: boolean | null;

	@Column({ type: DataType.ARRAY(DataType.STRING), defaultValue: [] })
	declare autoproxy_whitelist: string[];

	@Column({ type: DataType.ARRAY(DataType.STRING), defaultValue: [] })
	declare autoproxy_blacklist: string[];

	@Column({ type: DataType.BOOLEAN, allowNull: true, defaultValue: null })
	declare stickymode_setTo: boolean | null;

	@Column({ type: DataType.STRING, defaultValue: '' })
	declare tag: string;

	@Column({ type: DataType.BIGINT, allowNull: true, defaultValue: null })
	declare lastInteraction_timestamp: number | null;

	@Column({ type: DataType.INTEGER, allowNull: true, defaultValue: null })
	declare lastInteraction_channelId: string | null;

	@Column({ type: DataType.INTEGER, allowNull: true, defaultValue: null })
	declare resting_messageId: string | null;

	@Column({ type: DataType.INTEGER, allowNull: true, defaultValue: null })
	declare resting_channelId: string | null;

	@Column({ type: DataType.INTEGER, allowNull: true, defaultValue: null })
	declare componentDisabling_channelId: string | null;

	@Column({ type: DataType.INTEGER, allowNull: true, defaultValue: null })
	declare componentDisabling_messageId: string | null;

	@Column({ type: DataType.BOOLEAN, defaultValue: false })
	declare hasCooldown: boolean;
}