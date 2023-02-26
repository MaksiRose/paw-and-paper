import { BelongsTo, BelongsToMany, Column, DataType, ForeignKey, HasMany, Model, Table } from 'sequelize-typescript';
import DiscordUser from './discordUser';
import Group from './group';
import Quid from './quid';
import Server from './server';
import UserToServer from './userToServer';

@Table
export default class User extends Model {
	@Column({ type: DataType.STRING, primaryKey: true })
	declare id: string;

	@Column({ type: DataType.BOOLEAN, defaultValue: false })
	declare advice_resting: boolean;

	@Column({ type: DataType.BOOLEAN, defaultValue: false })
	declare advice_eating: boolean;

	@Column({ type: DataType.BOOLEAN, defaultValue: false })
	declare advice_drinking: boolean;

	@Column({ type: DataType.BOOLEAN, defaultValue: false })
	declare advice_passingOut: boolean;

	@Column({ type: DataType.BOOLEAN, defaultValue: false })
	declare advice_coloredButtons: boolean;

	@Column({ type: DataType.BOOLEAN, defaultValue: false })
	declare advice_sapling: boolean;

	@Column({ type: DataType.BOOLEAN, defaultValue: true })
	declare reminders_water: boolean;

	@Column({ type: DataType.BOOLEAN, defaultValue: true })
	declare reminders_resting: boolean;

	@Column({ type: DataType.BOOLEAN, defaultValue: false })
	declare proxy_globalAutoproxy: boolean;

	@Column({ type: DataType.BOOLEAN, defaultValue: false })
	declare proxy_globalStickymode: boolean;

	@ForeignKey(() => Quid)
	@Column({ type: DataType.STRING, allowNull: true, defaultValue: null })
	declare proxy_lastGlobalProxiedQuidId: string | null;

	@BelongsTo(() => Quid, { foreignKey: 'proxy_lastGlobalProxiedQuidId' })
	declare lastGlobalProxiedQuid: Quid;

	@Column({ type: DataType.BOOLEAN, defaultValue: false })
	declare accessibility_replaceEmojis: boolean;

	@Column({ type: DataType.STRING, defaultValue: '' })
	declare tag: string;

	@Column({ type: DataType.STRING, defaultValue: '' })
	declare lastPlayedVersion: string;

	@Column({ type: DataType.STRING, defaultValue: '' })
	declare antiproxy_startsWith: string;

	@Column({ type: DataType.STRING, defaultValue: '' })
	declare antiproxy_endsWith: string;

	@Column({ type: DataType.BIGINT, defaultValue: 0 })
	declare lastRecordedTopVote: number;

	@Column({ type: DataType.BIGINT, defaultValue: 0 })
	declare nextRedeemableTopVote: number;

	@Column({ type: DataType.BIGINT, defaultValue: 0 })
	declare lastRecordedDiscordsVote: number;

	@Column({ type: DataType.BIGINT, defaultValue: 0 })
	declare nextRedeemableDiscordsVote: number;

	@Column({ type: DataType.BIGINT, defaultValue: 0 })
	declare lastRecordedDblVote: number;

	@Column({ type: DataType.BIGINT, defaultValue: 0 })
	declare nextRedeemableDblVote: number;

	@BelongsToMany(() => Server, () => UserToServer)
	declare servers: Server[];

	@HasMany(() => Quid, { foreignKey: 'userId' })
	declare quids: Quid[];

	@HasMany(() => Group, { foreignKey: 'userId' })
	declare groups: Group[];

	@HasMany(() => DiscordUser, { foreignKey: 'userId' })
	declare discordUsers: DiscordUser;
}