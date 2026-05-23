export default (sequelize, DataTypes) => {
    const Issue = sequelize.define(
        "Issue",
        {
            id: {
                type: DataTypes.INTEGER,
                autoIncrement: true,
                primaryKey: true,
            },
            issue_id: {
                type: DataTypes.STRING(50),
                allowNull: false,
                unique: true,
            },
            user_id: {
                type: DataTypes.INTEGER,
                allowNull: false,
            },
            assigned_by: {
                type: DataTypes.JSON,
                allowNull: true,
                defaultValue: null,
            },
            assigned_date: {
                type: DataTypes.DATEONLY,
                allowNull: true,
            },
            issue_type: {
                type: DataTypes.STRING(100),
                allowNull: false,
            },
            title: {
                type: DataTypes.STRING(255),
                allowNull: false,
            },
            description: {
                type: DataTypes.TEXT,
                allowNull: true,
            },
            contact_mobile: {
                type: DataTypes.STRING(15),
                allowNull: true,
            },
            current_address: {
                type: DataTypes.JSON,
                allowNull: true,
            },
            status: {
                type: DataTypes.ENUM(
                    "Pending",
                    "In Progress",
                    "Resolved",
                    "Closed",
                    "Not-Resolved"
                ),
                defaultValue: "Pending",
            },
            created_date: {
                type: DataTypes.DATEONLY,
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
            tableName: "issues",
            timestamps: false,
        }
    );

    // Associations
    Issue.associate = (models) => {
        // Issue belongs to User (raised by)
        Issue.belongsTo(models.User, {
            foreignKey: "user_id",
            as: "user",
        });

        // Issue belongs to User (assigned by - for backward compatibility with assigned_by JSON field)
        // Note: This is a fake association since assigned_by is JSON, but it allows the include to work
        Issue.belongsTo(models.User, {
            foreignKey: "assigned_by",
            as: "assignedBy",
            constraints: false,
        });

        // Issue has many IssueMemberStatus records
        Issue.hasMany(models.IssueMemberStatus, {
            foreignKey: "issue_id",
            as: "memberStatuses",
        });

        // Issue belongs to many Users through IssueMemberStatus (assigned members)
        Issue.belongsToMany(models.User, {
            through: models.IssueMemberStatus,
            foreignKey: "issue_id",
            otherKey: "member_id",
            as: "assignedMembers",
        });
    };

    return Issue;
};