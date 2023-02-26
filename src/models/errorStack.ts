import { Optional } from 'sequelize';
import { Column, DataType, Model, Table } from 'sequelize-typescript';

interface ErrorStackAttributes {
	id: string;
	stack: string;
	isReported: boolean;
	version: string;
}

type ErrorStackOptionalAttributes = Optional<ErrorStackAttributes, 'isReported'>

@Table
export default class ErrorStack extends Model<ErrorStackAttributes, ErrorStackOptionalAttributes> {
	@Column({ type: DataType.STRING, primaryKey: true })
	declare id: string;

	@Column({ type: DataType.TEXT })
	declare stack: string;

	@Column({ type: DataType.BOOLEAN, defaultValue: false })
	declare isReported: boolean;

	@Column({ type: DataType.STRING })
	declare version: string;
}