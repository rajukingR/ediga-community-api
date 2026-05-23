export default (sequelize, DataTypes) => {
    const IssueMemberStatus = sequelize.define(
        "IssueMemberStatus",
        {
            id: {
                type: DataTypes.INTEGER,
                autoIncrement: true,
                primaryKey: true,
            },
            issue_id: {
                type: DataTypes.INTEGER,
                allowNull: false,
                references: {
                    model: 'issues',
                    key: 'id',
                },
            },
            member_id: {
                type: DataTypes.INTEGER,
                allowNull: false,
                references: {
                    model: 'users',
                    key: 'id',
                },
            },
            issue_status: {
                type: DataTypes.ENUM('pending', 'accept', 'reject'),
                defaultValue: 'pending',
            },
            remarks: {
                type: DataTypes.TEXT,
                allowNull: true,
            },
            created_at: {
                type: DataTypes.DATE,
                defaultValue: DataTypes.NOW,
            },
            updated_at: {
                type: DataTypes.DATE,
                defaultValue: DataTypes.NOW,
            },
        },
        {
            tableName: "issue_member_status",
            timestamps: false,
            indexes: [
                {
                    unique: true,
                    fields: ['issue_id', 'member_id'],
                    name: 'unique_issue_member'
                },
                {
                    fields: ['issue_id'],
                    name: 'idx_ims_issue'
                },
                {
                    fields: ['member_id'],
                    name: 'idx_ims_member'
                },
                {
                    fields: ['issue_status'],
                    name: 'idx_ims_status'
                }
            ]
        }
    );

    // Associations
    IssueMemberStatus.associate = (models) => {
        // IssueMemberStatus belongs to Issue
        IssueMemberStatus.belongsTo(models.Issue, {
            foreignKey: "issue_id",
            as: "issue",
        });

        // IssueMemberStatus belongs to Member (User)
        IssueMemberStatus.belongsTo(models.User, {
            foreignKey: "member_id",
            as: "member",
        });
    };

    return IssueMemberStatus;
};