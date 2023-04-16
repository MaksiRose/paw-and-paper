import { BelongsTo, Column, DataType, ForeignKey, Model, Table } from 'sequelize-typescript';
import Server from './server';

interface ChannelAttributes {
	id: string;
	serverId: string;
	webhookUrl: string;
}

@Table
export default class Channel extends Model<ChannelAttributes, ChannelAttributes> {
	@Column({ type: DataType.STRING, primaryKey: true })
	declare id: string;

	@ForeignKey(() => Server)
	@Column({ type: DataType.STRING })
	declare serverId: string;

	@BelongsTo(() => Server, { foreignKey: 'serverId' })
	declare server: Server;

	@Column({ type: DataType.STRING })
	declare webhookUrl: string;
}