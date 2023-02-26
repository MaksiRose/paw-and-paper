import { Column, DataType, Model, Table } from 'sequelize-typescript';

interface BannedUsersAttribute {
	id: string
}

@Table
export default class BannedUsers extends Model<BannedUsersAttribute, BannedUsersAttribute> {
	@Column({ type: DataType.STRING, primaryKey: true })
	declare id: string;
}