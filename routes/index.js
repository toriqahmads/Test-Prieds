var express = require('express');
var router = express.Router();
const stock_read_log = require('../models/stock_read_log');
const FileSystem = require("fs");
const { validationResult } = require('express-validator');
const validations = require('../validations/edit-repacking-data.validation');

router.use('/export-data', async (req, res) => {
  const list = await stock_read_log.aggregate([
    {
      $match: {}
    }
  ]).exec();
  
  FileSystem.writeFile('./stock_read_log.json', JSON.stringify(list), (error) => {
      if (error) throw error;
  });

  console.log('stock_read_log.json exported!');
  res.json({statusCode: 1, message: 'stock_read_log.json exported!'})
});

router.use('/import-data', async (req, res) => {
  const list = await stock_read_log.aggregate([
    {
      $match: {}
    }
  ]).exec();
  
  FileSystem.readFile('./stock_read_log.json', async (error, data) => {
      if (error) throw error;

      const list = JSON.parse(data);

      const deletedAll = await stock_read_log.deleteMany({});

      const insertedAll = await stock_read_log.insertMany(list);

      console.log('stock_read_log.json imported!');
  res.json({statusCode: 1, message: 'stock_read_log.json imported!'})
  });

  
})

router.use('/edit-repacking-data', async (req, res) => {
  
  // Silahkan dikerjakan disini.

  try {
    // validate the request body first
    // will return bad request response with errors message
    await Promise.all(validations().map(validation => validation.run(req)));
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        statusCode: 2,
        message: 'bad request',
        errors: errors.array()
      })
    }

    const { company_id, payload, reject_qr_list, new_qr_list } = req.body;

    // find the data first based on company id and the targeted payload
    const stock = await stock_read_log.findOne({
      company_id,
      payload,
    }, { _id: 1 }).exec();

    // throw an error if the data not found
    if (!stock) {
      throw new Error(`stock with payload ${payload} and company id ${company_id} not found`);
    }

    // map the stock id to array of id only for query purpose
    const mapped_id_stock_data = [stock._id];

    // check if there a reject_qr_list from body
    if (reject_qr_list && reject_qr_list.length > 0) {
      // map the payload to array of string only for query purpose
      const mapped_reject_qr = reject_qr_list.map(r => r.payload);

      // update status and status_qc of rejected qr list first
      // it will automatically throw an error and catched by catch block if there any error while updating the reject qr list
      await stock_read_log.updateMany({
        company_id,
        payload: {
          $in: mapped_reject_qr
        },
      }, {
        status: 0,
        status_qc: 1,
      }).exec();

      // pull or remove the rejected qr list from stock data target
      await stock_read_log.updateOne({
        _id: stock._id,
        company_id,
        payload,
      }, {
        $pull: {
          qr_list: {
            payload: {
              $in: mapped_reject_qr
            }
          }
        }
      })
      .exec();
    }

    // check if there a new_qr_list from body
    if (new_qr_list && new_qr_list.length > 0) {
      // map the payload to array of string only for query purpose
      const mapped_new_qr = new_qr_list.map(r => r.payload);

      // find the stock data that own the new qr list
      const stocks_have_qr_payload = await stock_read_log.find({
        company_id,
        qr_list: {
          $elemMatch: {
            payload: {
              $in: mapped_new_qr
            }
          }
        }
      }, { _id: 1, company_id: 1, payload: 1 })
      .exec();

      // check if stock data that own new qr list is exist
      if (stocks_have_qr_payload && stocks_have_qr_payload.length > 0) {
        // map the stock id to array of id only for query purpose
        stocks_have_qr_payload.map(s => mapped_id_stock_data.push(s._id));

        // pull the new qr list from stock data
        await stock_read_log.updateMany({
          _id: {
            $in: stocks_have_qr_payload.map(s => s._id)
          },
          company_id,
          qr_list: {
            $elemMatch: {
              payload: {
                $in: mapped_new_qr
              }
            }
          }
        }, {
          $pull: {
            qr_list: {
              payload: {
                $in: mapped_new_qr
              }
            }
          }
        }, {
          multi: true,
        })
        .exec();
      }

      // find the records of new qr list
      const new_qrs = await stock_read_log.find({
        company_id,
        payload: {
          $in: mapped_new_qr
        }
      })
      .exec();

      // push new qr list record to targeted stock data payload
      await stock_read_log.updateOne({
        _id: stock._id,
        company_id,
        payload,
      }, {
        $push: {
          qr_list: {
            $each: new_qrs
          }
        }
      })
      .exec();
    }

    // update the qty field by size of owned qr_list
    await stock_read_log.updateMany({
      company_id,
      _id: {
        $in: mapped_id_stock_data
      }
    }, [{
      $set: {
        qty: {
          $size: '$qr_list'
        }
      }
    }], {
      multi: true,
    })
    .exec();

    // fecth the new updated targeted stock data payload
    const updated_stock = await stock_read_log.findOne({
      company_id,
      payload,
    })
    .exec();

    // return it as json
    return res.status(200).json({
      statusCode: 1,
      message: 'successfully updated stock data',
      data: updated_stock
    });
  } catch (error) {
    console.error(error);
    throw error;
  }  
})

router.use('/', function(req, res, next) {
  res.render('index', { title: 'Express' });
});

module.exports = router;
