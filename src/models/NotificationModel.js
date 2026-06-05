export default (sequelize, DataTypes) => {
    const Notification = sequelize.define(
        "Notification",
        {
            id: {
                type: DataTypes.INTEGER,
                autoIncrement: true,
                primaryKey: true,
            },

            user_id: {
                type: DataTypes.INTEGER,
                allowNull: false,
            },

            message: {
                type: DataTypes.TEXT,
                allowNull: false,
            },

            message_type: {
                type: DataTypes.TEXT,
                allowNull: false,
            },

            is_read: {
                type: DataTypes.TINYINT(1),
                defaultValue: 0,
            },

            created_at: {
                type: DataTypes.DATE,
                defaultValue: DataTypes.NOW,
            },

            detail: {
                type: DataTypes.JSON,
                allowNull: true,
            },

            photo: {
                type: DataTypes.STRING(255),
                allowNull: true,
            },
        },
        {
            tableName: "notifications",
            timestamps: false,
        }
    );

    // Associations
    Notification.associate = (models) => {
        Notification.belongsTo(models.User, {
            foreignKey: "user_id",
            as: "user",
        });
    };

    return Notification;
};