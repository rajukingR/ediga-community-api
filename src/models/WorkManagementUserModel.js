// models/WorkManagementUserModel.js

export default (sequelize, DataTypes) => {
    const WorkManagementUser = sequelize.define(
        "WorkManagementUser",
        {
            id: {
                type: DataTypes.INTEGER,
                autoIncrement: true,
                primaryKey: true,
            },

            work_management_id: {
                type: DataTypes.INTEGER,
                allowNull: false,
                references: {
                    model: "work_management",
                    key: "id",
                },
                validate: {
                    isInt: true,
                    min: 1,
                },
            },

            user_id: {
                type: DataTypes.INTEGER,
                allowNull: false,
                references: {
                    model: "users",
                    key: "id",
                },
                validate: {
                    isInt: true,
                    min: 1,
                },
            },

            status: {
                type: DataTypes.ENUM(
                    "pending",
                    "in_progress",
                    "review",
                    "completed",
                    "blocked"
                ),
                allowNull: false,
                defaultValue: "pending",
            },

            remarks: {
                type: DataTypes.TEXT,
                allowNull: true,
            },

            completed_at: {
                type: DataTypes.DATE,
                allowNull: true,
            },

            created_at: {
                type: DataTypes.DATE,
                defaultValue: DataTypes.NOW,
                allowNull: false,
            },

            updated_at: {
                type: DataTypes.DATE,
                defaultValue: DataTypes.NOW,
                allowNull: false,
            },
        },
        {
            tableName: "work_management_users",
            timestamps: false,
        }
    );

    WorkManagementUser.associate = (models) => {
        WorkManagementUser.belongsTo(models.WorkManagement, {
            foreignKey: "work_management_id",
            as: "work",
        });

        WorkManagementUser.belongsTo(models.User, {
            foreignKey: "user_id",
            as: "user",
        });
    };

    return WorkManagementUser;
};