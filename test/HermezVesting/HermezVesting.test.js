const {ethers} = require("@nomiclabs/buidler");

let HermezVestingFactory,
  vestingVault,
  tokenFactory,
  token,
  multisig,
  multisig2,
  multisig3,
  recipient1,
  recipient2,
  recipient3,
  recipient4;
let multisigAddress,
  multisig2Address,
  multisig3Address,
  recipientAddress1,
  recipientAddress2,
  recipientAddress3,
  recipientAddress4;
let secondsPerDay = 86400;
const {expect} = require("chai");

describe("VestingVault revocable", function () {
  before(async function () {
    [
      multisig,
      multisig2,
      multisig3,
      recipient1,
      recipient2,
      recipient3,
      recipient4,
      ...addrs
    ] = await ethers.getSigners();

    multisigAddress = await multisig.getAddress();
    multisig2Address = await multisig2.getAddress();
    multisig3Address = await multisig3.getAddress();
    recipientAddress1 = await recipient1.getAddress();
    recipientAddress2 = await recipient2.getAddress();
    recipientAddress3 = await recipient3.getAddress();
    recipientAddress4 = await recipient4.getAddress();

    tokenFactory = await ethers.getContractFactory("HEZ");
    token = await tokenFactory.deploy(multisigAddress);
    await token.deployed();
    HermezVestingFactory = await ethers.getContractFactory("HermezVestingMock");
  });

  it("should check the constructor", async () => {
    const amount = ethers.utils.parseEther("20000000");
    const offset = 90 * (3600 * 24);
    const startTime = (await ethers.provider.getBlock()).timestamp;
    const startToCliff = 180 * (3600 * 24);
    const startToEnd = 730 * (3600 * 24);
    const initialPercentage = 5;

    await expect(HermezVestingFactory.deploy(
      multisigAddress,
      amount,
      startTime,
      startToEnd,
      startToCliff,
      initialPercentage,
      token.address
    )).to.be.revertedWith("HermezVesting::constructor: START_GREATER_THAN_CLIFF");

    await expect(HermezVestingFactory.deploy(
      multisigAddress,
      amount,
      startTime,
      startToCliff,
      startToEnd,
      initialPercentage + 100,
      token.address
    )).to.be.revertedWith("HermezVesting::constructor: INITIALPERCENTAGE_GREATER_THAN_100");
  })

  it("should deploy the HermezVesting", async () => {
    const amount = ethers.utils.parseEther("20000000");
    const offset = 90 * (3600 * 24);
    const startTime = (await ethers.provider.getBlock()).timestamp;
    const startToCliff = 180 * (3600 * 24);
    const startToEnd = 730 * (3600 * 24);
    const initialPercentage = 5;

    hermezVesting = await HermezVestingFactory.deploy(
      multisigAddress,
      amount,
      startTime,
      startToCliff,
      startToEnd,
      initialPercentage,
      token.address
    );

    let initialAmount = amount.mul(initialPercentage).div(100);

    // startTime > t
    expect(
      await hermezVesting.totalTokensUnlockedAt(startTime - offset)
    ).to.be.equal(0);
    // startTime = t
    expect(await hermezVesting.totalTokensUnlockedAt(startTime)).to.be.equal(
      initialAmount
    );
    // startTime < t < startToCliff
    expect(
      await hermezVesting.totalTokensUnlockedAt(startTime + offset)
    ).to.be.equal(initialAmount);
    // t + 1 = startToCliff
    expect(
      await hermezVesting.totalTokensUnlockedAt(startTime + startToCliff - 1)
    ).to.be.equal(initialAmount);
    // t = startToCliff
    expect(
      await hermezVesting.totalTokensUnlockedAt(startTime + startToCliff)
    ).to.be.equal(
      amount
        .sub(initialAmount)
        .mul(startToCliff)
        .div(startToEnd)
        .add(initialAmount)
    );
    // t = (startToEnd - startToCliff) / 2
    expect(
      await hermezVesting.totalTokensUnlockedAt(startTime + 365 * (3600 * 24))
    ).to.be.equal(amount.sub(initialAmount).div(2).add(initialAmount));
    // t = startToEnd
    expect(
      await hermezVesting.totalTokensUnlockedAt(startTime + startToEnd)
    ).to.be.equal(amount);
    // t > startToEnd
    expect(
      await hermezVesting.totalTokensUnlockedAt(startTime + startToEnd + offset)
    ).to.be.equal(amount);
  });

  it("should be able to transfer the balance", async () => {
    const amount = ethers.utils.parseEther("20000000");
    const offset = 90 * (3600 * 24);
    const startTime = (await ethers.provider.getBlock()).timestamp;
    const startToCliff = 180 * (3600 * 24);
    const startToEnd = 730 * (3600 * 24);
    const initialPercentage = 5;

    let hermezVesting = await HermezVestingFactory.deploy(
      multisigAddress,
      amount,
      startTime,
      startToCliff,
      startToEnd,
      initialPercentage,
      token.address
    );
    let amountRecipient1 = amount.div(2);
    let amountRecipient2 = amountRecipient1.div(2);
    let amountRecipient3 = amountRecipient2.div(2);
    let amountRecipient4 = amountRecipient3.div(2);

    await expect(hermezVesting.connect(recipient1).move(recipientAddress1, amountRecipient1)).to.be.revertedWith("HermezVesting::changeAddress: ONLY_DISTRIBUTOR");

    await expect(hermezVesting.move(recipientAddress1, amountRecipient1))
      .to.emit(hermezVesting, "Move")
      .withArgs(multisigAddress, recipientAddress1, amountRecipient1);
    await expect(hermezVesting.move(recipientAddress2, amountRecipient2))
      .to.emit(hermezVesting, "Move")
      .withArgs(multisigAddress, recipientAddress2, amountRecipient2);
    await expect(hermezVesting.move(recipientAddress3, amountRecipient3))
      .to.emit(hermezVesting, "Move")
      .withArgs(multisigAddress, recipientAddress3, amountRecipient3);
    await expect(hermezVesting.move(recipientAddress4, amountRecipient4))
      .to.emit(hermezVesting, "Move")
      .withArgs(multisigAddress, recipientAddress4, amountRecipient4);

    expect(await hermezVesting.vestedTokens(recipientAddress1)).to.be.equal(
      amountRecipient1
    );
    expect(await hermezVesting.vestedTokens(recipientAddress2)).to.be.equal(
      amountRecipient2
    );
    expect(await hermezVesting.vestedTokens(recipientAddress3)).to.be.equal(
      amountRecipient3
    );
    expect(await hermezVesting.vestedTokens(recipientAddress4)).to.be.equal(
      amountRecipient4
    );
  });

  it("should be able to get the correct withdrawableTokensAt", async () => {
    const amount = ethers.utils.parseEther("20000000");
    const offset = 90 * (3600 * 24);
    const startTime = (await ethers.provider.getBlock()).timestamp;
    const startToCliff = 180 * (3600 * 24);
    const startToEnd = 730 * (3600 * 24);
    const initialPercentage = 5;

    let hermezVesting = await HermezVestingFactory.deploy(
      multisigAddress,
      amount,
      startTime,
      startToCliff,
      startToEnd,
      initialPercentage,
      token.address
    );

    let amountRecipient1 = amount.div(2);
    let amountRecipient2 = amountRecipient1.div(2);
    let amountRecipient3 = amountRecipient2.div(2);
    let amountRecipient4 = amountRecipient3.div(2);

    hermezVesting.move(recipientAddress1, amountRecipient1);
    hermezVesting.move(recipientAddress2, amountRecipient2);
    hermezVesting.move(recipientAddress3, amountRecipient3);
    hermezVesting.move(recipientAddress4, amountRecipient4);

    let initialAmount = amount.mul(initialPercentage).div(100);
    let initialAmountRecipient = initialAmount
      .mul(amountRecipient1)
      .div(amount);

    // startTime > t
    expect(
      await hermezVesting.withdrawableTokensAt(
        recipientAddress1,
        startTime - offset
      )
    ).to.be.equal(0);
    // startTime = t
    expect(
      await hermezVesting.withdrawableTokensAt(recipientAddress1, startTime)
    ).to.be.equal(initialAmountRecipient);
    // startTime < t < startToCliff
    expect(
      await hermezVesting.withdrawableTokensAt(
        recipientAddress1,
        startTime + offset
      )
    ).to.be.equal(initialAmountRecipient);
    // t + 1 = startToCliff
    expect(
      await hermezVesting.withdrawableTokensAt(
        recipientAddress1,
        startTime + startToCliff - 1
      )
    ).to.be.equal(initialAmountRecipient);
    // t = startToCliff
    let totalTokensUnlockedAt1 = await hermezVesting.totalTokensUnlockedAt(
      startTime + startToCliff
    );
    expect(
      await hermezVesting.withdrawableTokensAt(
        recipientAddress1,
        startTime + startToCliff
      )
    ).to.be.equal(totalTokensUnlockedAt1.mul(amountRecipient1).div(amount));
    // t = (startToEnd - startToCliff) / 2
    let totalTokensUnlockedAt2 = await hermezVesting.totalTokensUnlockedAt(
      startTime + 365 * (3600 * 24)
    );
    expect(
      await hermezVesting.withdrawableTokensAt(
        recipientAddress1,
        startTime + 365 * (3600 * 24)
      )
    ).to.be.equal(totalTokensUnlockedAt2.mul(amountRecipient1).div(amount));
    // t = startToEnd
    expect(
      await hermezVesting.withdrawableTokensAt(
        recipientAddress1,
        startTime + startToEnd
      )
    ).to.be.equal(amount.mul(amountRecipient1).div(amount));
    // t > startToEnd
    expect(
      await hermezVesting.withdrawableTokensAt(
        recipientAddress1,
        startTime + startToEnd + offset
      )
    ).to.be.equal(amount.mul(amountRecipient1).div(amount));
  });

  it("should be able to withdraw", async () => {
    const amount = ethers.utils.parseEther("20000000");
    const now = (await ethers.provider.getBlock()).timestamp;
    const offset = 365 * (3600 * 24);
    const startTime = now - offset;
    const startToCliff = 180 * (3600 * 24);
    const startToEnd = 730 * (3600 * 24);
    const initialPercentage = 5;

    let hermezVesting = await HermezVestingFactory.deploy(
      multisigAddress,
      amount,
      startTime,
      startToCliff,
      startToEnd,
      initialPercentage,
      token.address
    );

    await token.transfer(hermezVesting.address, amount);

    let amountRecipient1 = amount.div(2);
    let amountRecipient2 = amountRecipient1.div(2);
    let amountRecipient3 = amountRecipient2.div(2);
    let amountRecipient4 = amountRecipient3.div(2);

    hermezVesting.move(recipientAddress1, amountRecipient1);
    hermezVesting.move(recipientAddress2, amountRecipient2);
    hermezVesting.move(recipientAddress3, amountRecipient3);
    hermezVesting.move(recipientAddress4, amountRecipient4);

    let nowTimestamp = now;
    await hermezVesting.setTimestamp(nowTimestamp);
    await expect(await hermezVesting.getTimestamp()).to.be.equal(now);

    let withdrawableTokensAtRecipient1 = await hermezVesting.withdrawableTokensAt(
      recipientAddress1,
      nowTimestamp
    );

    await expect(hermezVesting.withdraw()).to.be.revertedWith("HermezVesting::withdraw: DISTRIBUTOR_CANNOT_WITHDRAW");

    await expect(hermezVesting.connect(recipient1).withdraw())
      .to.emit(hermezVesting, "Withdraw")
      .withArgs(recipientAddress1, withdrawableTokensAtRecipient1);

    let withdrawableTokensAtRecipient2 = await hermezVesting.withdrawableTokensAt(
      recipientAddress2,
      nowTimestamp
    );
    expect(await hermezVesting.withdrawableTokensAt(
      recipientAddress2,
      nowTimestamp
    )).to.be.equal(await hermezVesting.withdrawableTokens(
      recipientAddress2
    ));

    await expect(hermezVesting.connect(recipient2).withdraw())
      .to.emit(hermezVesting, "Withdraw")
      .withArgs(recipientAddress2, withdrawableTokensAtRecipient2);

    let withdrawableTokensAtRecipient3 = await hermezVesting.withdrawableTokensAt(
      recipientAddress3,
      nowTimestamp
    );
    await expect(hermezVesting.connect(recipient3).withdraw())
      .to.emit(hermezVesting, "Withdraw")
      .withArgs(recipientAddress3, withdrawableTokensAtRecipient3);

    let withdrawableTokensAtRecipient4 = await hermezVesting.withdrawableTokensAt(
      recipientAddress4,
      nowTimestamp
    );
    await expect(hermezVesting.connect(recipient4).withdraw())
      .to.emit(hermezVesting, "Withdraw")
      .withArgs(recipientAddress4, withdrawableTokensAtRecipient4);
  });
  it("should be able to change the address", async () => {
    const amount = ethers.utils.parseEther("20000000");
    const now = (await ethers.provider.getBlock()).timestamp;
    const offset = 365 * (3600 * 24);
    const startTime = now - offset;
    const startToCliff = 180 * (3600 * 24);
    const startToEnd = 730 * (3600 * 24);
    const initialPercentage = 5;

    let hermezVesting = await HermezVestingFactory.deploy(
      multisigAddress,
      amount,
      startTime,
      startToCliff,
      startToEnd,
      initialPercentage,
      token.address
    );
    await token.transfer(hermezVesting.address, amount);

    let amountRecipient1 = amount.div(2);
    await hermezVesting.move(recipientAddress1, amountRecipient1);
    await hermezVesting.connect(recipient1).withdraw();
    let withdrawed = await hermezVesting.withdrawed(recipientAddress1);
    let totalVested = await hermezVesting.vestedTokens(recipientAddress1);
    await expect(hermezVesting.connect(recipient1).changeAddress(recipientAddress2)).to.emit(hermezVesting,"ChangeAddress").withArgs(recipientAddress1,recipientAddress2);
    expect(await hermezVesting.withdrawed(recipientAddress1)).to.be.equal(0);
    expect(await hermezVesting.vestedTokens(recipientAddress1)).to.be.equal(0);
    expect(await hermezVesting.withdrawed(recipientAddress2)).to.be.equal(withdrawed);
    expect(await hermezVesting.vestedTokens(recipientAddress2)).to.be.equal(totalVested);
  })

  it("should be able to change the address if it's the distributor", async () => {
    const amount = ethers.utils.parseEther("20000000");
    const now = (await ethers.provider.getBlock()).timestamp;
    const offset = 365 * (3600 * 24);
    const startTime = now - offset;
    const startToCliff = 180 * (3600 * 24);
    const startToEnd = 730 * (3600 * 24);
    const initialPercentage = 5;

    let hermezVesting = await HermezVestingFactory.deploy(
      multisigAddress,
      amount,
      startTime,
      startToCliff,
      startToEnd,
      initialPercentage,
      token.address
    );
    await token.transfer(hermezVesting.address, amount);

    let amountRecipient1 = amount.div(2);
    let amountRecipient2 = amountRecipient1.div(2);
    let amountRecipient3 = amountRecipient2.div(2);
    let amountRecipient4 = amountRecipient3.div(2);

    await hermezVesting.move(recipientAddress1, amountRecipient1);
    await hermezVesting.move(recipientAddress3, amountRecipient3);

    await hermezVesting.connect(recipient1).withdraw();
    let previousDistributor = await hermezVesting.vestedTokens(multisigAddress);
    await expect(hermezVesting.connect(recipient1).changeAddress(recipientAddress3)).to.be.revertedWith("HermezVesting::changeAddress: ADDRESS_HAS_BALANCE");
    await expect(hermezVesting.changeAddress(recipientAddress1)).to.be.revertedWith("HermezVesting::changeAddress: ADDRESS_HAS_BALANCE");
    await expect(hermezVesting.changeAddress(recipientAddress2)).to.emit(hermezVesting,"ChangeAddress").withArgs(multisigAddress,recipientAddress2);
    expect(await hermezVesting.vestedTokens(recipientAddress2)).to.be.equal(previousDistributor);
    expect(await hermezVesting.vestedTokens(multisigAddress)).to.be.equal(0);
  })
  
  it("shouldn't be able to change to the distributor address when distributor balance is 0", async () => {
    const amount = ethers.utils.parseEther("20000000");
    const now = (await ethers.provider.getBlock()).timestamp;
    const offset = 365 * (3600 * 24);
    const startTime = now - offset;
    const startToCliff = 180 * (3600 * 24);
    const startToEnd = 730 * (3600 * 24);
    const initialPercentage = 5;

    let hermezVesting = await HermezVestingFactory.deploy(
      multisigAddress,
      amount,
      startTime,
      startToCliff,
      startToEnd,
      initialPercentage,
      token.address
    );
    await token.transfer(hermezVesting.address, amount);

    let amountRecipient1 = amount.div(2);
    await hermezVesting.move(recipientAddress1, amountRecipient1);
    await hermezVesting.move(recipientAddress2, amount.sub(amountRecipient1));
    expect(await hermezVesting.vestedTokens(multisigAddress)).to.be.equal(0);
    await hermezVesting.connect(recipient1).withdraw();
    await expect(hermezVesting.connect(recipient1).changeAddress(multisigAddress)).to.be.revertedWith("HermezVesting::changeAddress: DISTRIBUTOR_NOT_ALLOWED");
  })

});
