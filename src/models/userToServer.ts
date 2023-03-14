import { Optional } from 'sequelize';
import { BelongsTo, Column, DataType, ForeignKey, Model, Table } from 'sequelize-typescript';
import Quid from './quid';
import Server from './server';
import User from './user';

interface UserToServerAttributes {
	id: string;
	userId: string;
	serverId: string;
	lastProxiedQuidId: string | null;
	activeQuidId: string | null;
	autoproxy_setToWhitelist: boolean | null;
	autoproxy_whitelist: string[];
	autoproxy_blacklist: string[];
	stickymode_setTo: boolean | null;
	tag: string;
	lastInteraction_timestamp: number | null;
	lastInteraction_channelId: string | null;
	resting_messageId: string | null;
	resting_channelId: string | null;
	/** @deprecated */
	componentDisabling_channelId: string | null;
	/** @deprecated */
	componentDisabling_messageId: string | null;
	hasCooldown: boolean;
}

type UserToServerCreationAttributes = Optional<UserToServerAttributes, 'autoproxy_setToWhitelist' | 'autoproxy_whitelist' | 'autoproxy_blacklist' | 'stickymode_setTo' | 'tag' | 'lastInteraction_timestamp' | 'lastInteraction_channelId' | 'resting_messageId' | 'resting_channelId' | 'componentDisabling_channelId' | 'componentDisabling_messageId' | 'hasCooldown'>;

@Table
export default class UserToServer extends Model<UserToServerAttributes, UserToServerCreationAttributes> {
	@Column({ type: DataType.STRING, primaryKey: true })
	declare id: string;

	@ForeignKey(() => User)
	@Column({ type: DataType.STRING })
	declare userId: string;

	@ForeignKey(() => Server)
	@Column({ type: DataType.STRING })
	declare serverId: string;

	@ForeignKey(() => Quid<false>)
	@Column({ type: DataType.STRING, allowNull: true })
	declare lastProxiedQuidId: string | null;

	@BelongsTo(() => Quid, { foreignKey: 'lastProxiedQuidId' })
	declare lastProxiedQuid: Quid | null;

	@ForeignKey(() => Quid<false>)
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

	@Column({ type: DataType.INTEGER, allowNull: true, defaultValue: null })
	declare lastInteraction_timestamp: number | null;

	@Column({ type: DataType.STRING, allowNull: true, defaultValue: null })
	declare lastInteraction_channelId: string | null;

	@Column({ type: DataType.STRING, allowNull: true, defaultValue: null })
	declare resting_messageId: string | null;

	@Column({ type: DataType.STRING, allowNull: true, defaultValue: null })
	declare resting_channelId: string | null;

	@Column({ type: DataType.STRING, allowNull: true, defaultValue: null })
	/** @deprecated */
	declare componentDisabling_channelId: string | null;

	@Column({ type: DataType.STRING, allowNull: true, defaultValue: null })
	/** @deprecated */
	declare componentDisabling_messageId: string | null;

	@Column({ type: DataType.BOOLEAN, defaultValue: false })
	declare hasCooldown: boolean;
}