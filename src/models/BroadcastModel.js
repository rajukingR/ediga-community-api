export default (sequelize, DataTypes) => {
    const Broadcast = sequelize.define(
        "Broadcast",
        {
            id: {
                type: DataTypes.INTEGER,
                autoIncrement: true,
                primaryKey: true,
            },

            broadcast_id: {
                type: DataTypes.STRING(50),
                allowNull: false,
                unique: true,
            },

            title: {
                type: DataTypes.STRING(255),
                allowNull: false,
            },

            description: {
                type: DataTypes.TEXT,
                allowNull: false,
            },
             image: {
                type: DataTypes.STRING(255),
                allowNull: true,
            },

            receiver: {
                type: DataTypes.JSON,
                allowNull: false,
               
            },
            target_user_ids: {
                type: DataTypes.JSON,
                allowNull: true,
                defaultValue: null
            },

            status: {
                type: DataTypes.ENUM('draft', 'scheduled', 'sent', 'failed', 'cancelled'),
                defaultValue: 'draft',
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
            tableName: "broadcasts",
            timestamps: false,
        }
    );

    // Associations
    Broadcast.associate = (models) => {
        // Add any associations here if needed
        // For example, if you want to track who created the broadcast
        // Broadcast.belongsTo(models.User, {
        //     foreignKey: "created_by",
        //     as: "creator",
        // });
    };

    return Broadcast;
};