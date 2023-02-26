import { Column, DataType, Model, Table } from 'sequelize-typescript';

@Table
export default class ErrorStack extends Model {
	@Column({ type: DataType.STRING, primaryKey: true })
	declare id: string;

	@Column({ type: DataType.TEXT })
	declare stack: string;

	@Column({ type: DataType.BOOLEAN, defaultValue: false })
	declare isReported: boolean;

	@Column({ type: DataType.STRING })
	declare version: string;
}