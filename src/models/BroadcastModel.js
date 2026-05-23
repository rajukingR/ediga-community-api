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

            receiver: {
                type: DataTypes.JSON,
                allowNull: false,
                validate: {
                    isValidReceiver(value) {
                        if (!Array.isArray(value)) {
                            throw new Error('Receiver must be an array');
                        }
                        const validTypes = ['member', 'volunteer_member', 'professional_volunteer'];
                        for (const type of value) {
                            if (!validTypes.includes(type)) {
                                throw new Error(`Invalid receiver type: ${type}. Allowed: ${validTypes.join(', ')}`);
                            }
                        }
                    }
                }
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