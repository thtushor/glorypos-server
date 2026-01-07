'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('AdvanceSalaries', {
      id: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true,
      },
      userId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'UserRole',
          key: 'id',
        },
        onDelete: 'CASCADE',
      },
      salaryMonth: {
        type: Sequelize.STRING, // Format: "YYYY-MM"
        allowNull: false,
        comment: "Salary month for which advance is taken",
      },
      amount: {
        type: Sequelize.DECIMAL(12, 2),
        allowNull: false,
        validate: { min: 0 },
      },
      reasonss: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      approvedBy: {
        type: Sequelize.INTEGER,
        allowNull: true, // Can be null if status is PENDING
        references: {
          model: 'Users',
          key: 'id',
        },
      },
      status: {
        type: Sequelize.ENUM('PENDING', 'APPROVED', 'REJECTED'),
        allowNull: false,
        defaultValue: 'PENDING',
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE,
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE,
      },
    });

    // Add indexes for faster lookups with explicit names to avoid duplicates
    try {
      await queryInterface.addIndex('AdvanceSalaries', ['userId'], {
        name: 'advance_salaries_user_id'
      });
    } catch (error) {
      if (!error.message.includes('Duplicate key name')) {
        throw error;
      }
    }

    try {
      await queryInterface.addIndex('AdvanceSalaries', ['salaryMonth'], {
        name: 'advance_salaries_salary_month'
      });
    } catch (error) {
      if (!error.message.includes('Duplicate key name')) {
        throw error;
      }
    }
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('AdvanceSalaries');
  }
};
