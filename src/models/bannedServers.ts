import { Column, DataType, Model, Table } from 'sequelize-typescript';

@Table
export default class BannedServers extends Model {
	@Column({ type: DataType.STRING, primaryKey: true })
	declare id: string;
}